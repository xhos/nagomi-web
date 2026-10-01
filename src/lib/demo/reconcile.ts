// core's statement reconciliation (nagomi-core internal/service/reconcile.go), ported so
// the demo plans and applies imports the way core does. planReconcile mirrors
// core's planReconcile line for line; keep them in step.
import { create } from "@bufbuild/protobuf";
import type { Date as ProtoDate } from "@/gen/google/type/date_pb";
import {
	TransactionDirection,
	TransactionSource,
} from "@/gen/nagomi/v1/enums_pb";
import type { ParsedStatementLine } from "@/gen/nagomi/v1/statement_parser_pb";
import type { Statement } from "@/gen/nagomi/v1/statement_pb";
import {
	ReconciliationAction,
	ReconciliationKeepReason,
	StatementReconciliationSchema,
} from "@/gen/nagomi/v1/statement_services_pb";
import {
	type Transaction,
	TransactionSchema,
} from "@/gen/nagomi/v1/transaction_pb";
import {
	cents,
	db,
	lineExternalIds,
	money,
	nextId,
	statementLinks,
	ts,
	tsDate,
} from "./data";

const DATE_WINDOW = 3;
const AMOUNT_TOLERANCE = 0.25;
const GRACE_DAYS = 5;

// calendar days as whole numbers, so they compare without zone drift
export const dayNumber = (d: Date) =>
	Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400e3);
const protoDay = (d?: ProtoDate) =>
	d ? Math.round(Date.UTC(d.year, d.month - 1, d.day) / 86400e3) : 0;
const protoDateLocal = (d?: ProtoDate) =>
	d ? new Date(d.year, d.month - 1, d.day) : new Date();

export interface ReconcileLine {
	day: number;
	amountCents: bigint;
	direction: TransactionDirection;
}

export interface ReconcileCandidate {
	id: bigint;
	day: number;
	amountCents: bigint;
	direction: TransactionDirection;
	source: TransactionSource;
	// notes, a receipt or splits: never deleted automatically
	hasUserData: boolean;
	// already a line of the statement being re-parsed
	fromStatement: boolean;
}

export interface ReconcilePlan {
	matches: { line: number; transactionId: bigint; amountChanged: boolean }[];
	create: number[];
	delete: bigint[];
	keep: { transactionId: bigint; reason: ReconciliationKeepReason }[];
}

export function planReconcile(
	lines: ReconcileLine[],
	candidates: ReconcileCandidate[],
	periodStart: number,
	periodEnd: number,
): ReconcilePlan {
	const plan: ReconcilePlan = { matches: [], create: [], delete: [], keep: [] };
	const lineUsed = lines.map(() => false);
	const candUsed = candidates.map(() => false);

	// pass 1: exact amount, globally closest dates first
	const exact: { line: number; cand: number; dist: number }[] = [];
	lines.forEach((line, i) => {
		candidates.forEach((cand, j) => {
			const dist = Math.abs(line.day - cand.day);
			if (
				cand.direction === line.direction &&
				cand.amountCents === line.amountCents &&
				dist <= DATE_WINDOW
			)
				exact.push({ line: i, cand: j, dist });
		});
	});
	exact.sort((a, b) => a.dist - b.dist);
	for (const p of exact) {
		if (lineUsed[p.line] || candUsed[p.cand]) continue;
		lineUsed[p.line] = candUsed[p.cand] = true;
		plan.matches.push({
			line: p.line,
			transactionId: candidates[p.cand].id,
			amountChanged: false,
		});
	}

	// pass 2: amount within tolerance, only when line and transaction have no other option
	const near = (line: ReconcileLine, cand: ReconcileCandidate) => {
		const diff = line.amountCents - cand.amountCents;
		const abs = diff < 0 ? -diff : diff;
		return (
			cand.direction === line.direction &&
			Math.abs(line.day - cand.day) <= DATE_WINDOW &&
			Number(abs) <= AMOUNT_TOLERANCE * Number(line.amountCents)
		);
	};
	const lineOptions: number[][] = lines.map(() => []);
	const candOptions = candidates.map(() => 0);
	lines.forEach((line, i) => {
		if (lineUsed[i]) return;
		candidates.forEach((cand, j) => {
			if (!candUsed[j] && near(line, cand)) {
				lineOptions[i].push(j);
				candOptions[j]++;
			}
		});
	});
	lineOptions.forEach((options, i) => {
		if (options.length !== 1 || candOptions[options[0]] !== 1) return;
		const j = options[0];
		lineUsed[i] = candUsed[j] = true;
		plan.matches.push({
			line: i,
			transactionId: candidates[j].id,
			amountChanged: true,
		});
	});
	plan.matches.sort((a, b) => a.line - b.line);

	lines.forEach((_, i) => {
		if (!lineUsed[i]) plan.create.push(i);
	});

	const graceFrom = periodEnd - GRACE_DAYS;
	candidates.forEach((cand, j) => {
		if (candUsed[j]) return;
		if (cand.fromStatement) {
			if (cand.hasUserData)
				plan.keep.push({
					transactionId: cand.id,
					reason: ReconciliationKeepReason.USER_DATA,
				});
			else plan.delete.push(cand.id);
			return;
		}
		if (cand.day < periodStart || cand.day > periodEnd) return;
		const provisional =
			cand.source === TransactionSource.EMAIL ||
			cand.source === TransactionSource.CONNECTOR;
		if (!provisional)
			plan.keep.push({
				transactionId: cand.id,
				reason: ReconciliationKeepReason.MANUAL,
			});
		else if (cand.hasUserData)
			plan.keep.push({
				transactionId: cand.id,
				reason: ReconciliationKeepReason.USER_DATA,
			});
		else if (cand.day > graceFrom)
			plan.keep.push({
				transactionId: cand.id,
				reason: ReconciliationKeepReason.GRACE,
			});
		else plan.delete.push(cand.id);
	});

	return plan;
}

const hasSplits = (id: bigint) =>
	db.transactions.some((t) => t.splitFromId === id);

export interface Reconciliation {
	accountId: bigint;
	plan: ReconcilePlan;
	lines: ParsedStatementLine[];
	externalIds: string[];
	alreadyImported: Set<number>;
	candidates: Map<bigint, Transaction>;
}

// plans an import of these lines into the account. reparsing is the statement being
// re-parsed, whose own transactions become candidates too.
export function reconcileAccount(
	lines: ParsedStatementLine[],
	periodStart: ProtoDate | undefined,
	periodEnd: ProtoDate | undefined,
	accountId: bigint,
	reparsing?: bigint,
): Reconciliation {
	const externalIds = lineExternalIds(lines);
	const imported = new Set(
		db.transactions
			.filter((t) => t.accountId === accountId && t.externalId)
			.map((t) => t.externalId as string),
	);

	const alreadyImported = new Set<number>();
	const pending: ReconcileLine[] = [];
	const index: number[] = [];
	lines.forEach((l, i) => {
		if (imported.has(externalIds[i])) {
			alreadyImported.add(i);
			return;
		}
		pending.push({
			day: protoDay(l.date),
			amountCents: l.amountCents,
			direction: l.direction,
		});
		index.push(i);
	});

	const start = protoDay(periodStart);
	const end = protoDay(periodEnd);
	const own = new Set(externalIds.filter((id) => imported.has(id)));
	const candidates = new Map<bigint, Transaction>();
	const planned: ReconcileCandidate[] = [];
	for (const t of db.transactions) {
		if (t.accountId !== accountId || t.splitFromId !== undefined) continue;
		const day = dayNumber(tsDate(t.txDate));
		const link = statementLinks.get(t.id);
		const fromStatement = reparsing !== undefined && link === reparsing;
		const inWindow =
			link === undefined &&
			day >= start - DATE_WINDOW &&
			day <= end + DATE_WINDOW;
		if (!inWindow && !fromStatement) continue;
		// already this statement's line: unchanged by a re-parse, or not linked to it yet
		if (t.externalId && own.has(t.externalId)) continue;
		candidates.set(t.id, t);
		planned.push({
			id: t.id,
			day,
			amountCents: BigInt(cents(t.txAmount)),
			direction: t.direction,
			source: t.source,
			hasUserData:
				!!t.userNotes || t.receiptId !== undefined || hasSplits(t.id),
			fromStatement,
		});
	}
	planned.sort((a, b) => a.day - b.day || Number(a.id - b.id));

	const plan = planReconcile(pending, planned, start, end);
	for (const m of plan.matches) m.line = index[m.line];
	plan.create = plan.create.map((i) => index[i]);

	return { accountId, plan, lines, externalIds, alreadyImported, candidates };
}

export function reconciliationToPb(r: Reconciliation) {
	const matched = new Map(r.plan.matches.map((m) => [m.line, m]));
	const items = r.lines.map((_, i) => {
		const m = matched.get(i);
		return {
			lineIndex: i,
			action: r.alreadyImported.has(i)
				? ReconciliationAction.ALREADY_IMPORTED
				: m
					? m.amountChanged
						? ReconciliationAction.UPDATE_AMOUNT
						: ReconciliationAction.CONFIRM
					: ReconciliationAction.CREATE,
			transaction: m && r.candidates.get(m.transactionId),
		};
	});
	return create(StatementReconciliationSchema, {
		accountId: r.accountId,
		items: [
			...items,
			...r.plan.delete.map((id) => ({
				action: ReconciliationAction.DELETE,
				transaction: r.candidates.get(id),
			})),
			...r.plan.keep.map((k) => ({
				action: ReconciliationAction.KEEP,
				transaction: r.candidates.get(k.transactionId),
				keepReason: k.reason,
			})),
		],
	});
}

// writes the plan; remove deletes transactions the way the demo's delete does
export function applyReconciliation(
	r: Reconciliation,
	statement: Statement,
	remove: (ids: bigint[]) => void,
) {
	const source = TransactionSource.STATEMENT;
	let updated = 0;

	for (const m of r.plan.matches) {
		const line = r.lines[m.line];
		const t = r.candidates.get(m.transactionId);
		if (!t) continue;
		const oldCents = cents(t.txAmount);
		// keep the provisional time of day when the statement agrees on the day
		if (dayNumber(tsDate(t.txDate)) !== protoDay(line.date))
			t.txDate = ts(protoDateLocal(line.date));
		t.txAmount = money(Number(line.amountCents), statement.currency);
		t.description = line.description;
		t.externalId = r.externalIds[m.line];
		t.source = source;
		statementLinks.set(t.id, statement.id);
		if (m.amountChanged) {
			updated++;
			// keep each friend's share proportional, like editing the amount by hand
			if (oldCents !== 0)
				for (const split of db.transactions.filter(
					(s) => s.splitFromId === t.id,
				)) {
					const ratio = Number(line.amountCents) / oldCents;
					split.txAmount = money(
						Math.round(cents(split.txAmount) * ratio),
						statement.currency,
					);
				}
		}
	}

	const created: bigint[] = [];
	for (const i of r.plan.create) {
		const line = r.lines[i];
		const t = create(TransactionSchema, {
			id: nextId(),
			accountId: r.accountId,
			txDate: ts(protoDateLocal(line.date)),
			txAmount: money(Number(line.amountCents), statement.currency),
			direction: line.direction,
			description: line.description,
			externalId: r.externalIds[i],
			source,
			createdAt: ts(new Date()),
			updatedAt: ts(new Date()),
		});
		db.transactions.push(t);
		statementLinks.set(t.id, statement.id);
		created.push(t.id);
	}

	for (const i of r.alreadyImported) {
		const t = db.transactions.find(
			(x) => x.accountId === r.accountId && x.externalId === r.externalIds[i],
		);
		if (t && !statementLinks.has(t.id)) statementLinks.set(t.id, statement.id);
	}

	remove(r.plan.delete);

	return {
		created: created.length,
		duplicates: r.alreadyImported.size,
		confirmed: r.plan.matches.length - updated,
		updated,
		deleted: r.plan.delete.length,
		kept: r.plan.keep.length,
	};
}

export const signedCents = (l: ParsedStatementLine) =>
	l.direction === TransactionDirection.DIRECTION_OUTGOING
		? -l.amountCents
		: l.amountCents;
