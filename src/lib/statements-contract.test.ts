import assert from "node:assert/strict";
import { test } from "node:test";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { DateSchema } from "@/gen/google/type/date_pb";
import { UpdateAccountRequestSchema } from "@/gen/nagomi/v1/account_services_pb";
import {
	AccountType,
	TransactionDirection,
	TransactionSource,
} from "@/gen/nagomi/v1/enums_pb";
import { StatementCoverageStatus } from "@/gen/nagomi/v1/statement_pb";
import {
	ReconciliationAction,
	ReconciliationKeepReason,
} from "@/gen/nagomi/v1/statement_services_pb";
import { accountClient, statementClient } from "./demo/clients";
import {
	type CoveragePeriod,
	type CoverageSettings,
	type CoverageStatement,
	planCoverage,
	utcDay,
} from "./demo/coverage";
import { db, demoPdf } from "./demo/data";
import {
	dayNumber,
	planReconcile,
	type ReconcileCandidate,
	type ReconcileLine,
	type ReconcilePlan,
} from "./demo/reconcile";

const pdfNamed = (name: string) => demoPdf([name, String(Math.random())]);

test("statement settings are set, kept, and cleared through the update mask like core", async () => {
	const acct = db.accounts.find((a) => a.statementDriven);
	assert.ok(acct);
	const update = (
		init: Parameters<typeof create<typeof UpdateAccountRequestSchema>>[1],
	) =>
		accountClient.updateAccount(
			create(UpdateAccountRequestSchema, {
				userId: "demo",
				id: acct.id,
				...init,
			}),
		);

	await update({
		updateMask: { paths: ["statements_start"] },
		statementsStart: create(DateSchema, { year: 2025, month: 1, day: 1 }),
	});
	assert.equal(acct.statementsStart?.year, 2025);

	// not masked: left alone
	await update({ updateMask: { paths: ["name"] }, name: acct.name });
	assert.equal(acct.statementsStart?.year, 2025);

	// masked and unset: cleared
	await update({ updateMask: { paths: ["statements_start"] } });
	assert.equal(acct.statementsStart, undefined);
});

test("statements import only into statement-driven accounts, and new ones are statement-driven", async () => {
	const plain = db.accounts.find(
		(a) => !a.statementDriven && a.type === AccountType.ACCOUNT_SAVINGS,
	);
	assert.ok(plain);

	const preview = await statementClient.previewStatementImport({
		userId: "demo",
		pdfData: pdfNamed("visa"),
		fileName: "visa-statement.pdf",
	});
	const statementId = preview.statement?.id;
	assert.ok(statementId);

	await assert.rejects(
		statementClient.commitStatementImport({
			userId: "demo",
			statementId,
			account: { case: "accountId", value: plain.id },
		}),
		(e) => ConnectError.from(e).code === Code.InvalidArgument,
	);

	const r = await statementClient.commitStatementImport({
		userId: "demo",
		statementId,
		account: { case: "newAccountName", value: "new visa" },
	});
	const created = db.accounts.find((a) => a.id === r.statement?.accountId);
	assert.equal(created?.statementDriven, true);
});

// core's TestPlanReconcile cases (nagomi-core internal/service/reconcile_test.go)
test("the demo plans reconciliation exactly like core", () => {
	const day = (d: number) => dayNumber(new Date(2026, 2, d));
	const out = TransactionDirection.DIRECTION_OUTGOING;
	const inc = TransactionDirection.DIRECTION_INCOMING;
	const email = TransactionSource.EMAIL;
	const manual = TransactionSource.MANUAL;
	const statement = TransactionSource.STATEMENT;
	const line = (d: number, cents: number): ReconcileLine => ({
		day: day(d),
		amountCents: BigInt(cents),
		direction: out,
	});
	const cand = (
		id: number,
		d: number,
		cents: number,
		extra: Partial<ReconcileCandidate> = {},
	): ReconcileCandidate => ({
		id: BigInt(id),
		day: day(d),
		amountCents: BigInt(cents),
		direction: out,
		source: email,
		hasUserData: false,
		fromStatement: false,
		...extra,
	});
	const match = (l: number, id: number, amountChanged = false) => ({
		line: l,
		transactionId: BigInt(id),
		amountChanged,
	});
	const K = ReconciliationKeepReason;
	const empty: ReconcilePlan = {
		matches: [],
		create: [],
		delete: [],
		keep: [],
	};
	const feb27 = dayNumber(new Date(2026, 1, 27));
	const apr2 = dayNumber(new Date(2026, 3, 2));

	const cases: [
		string,
		ReconcileLine[],
		ReconcileCandidate[],
		Partial<ReconcilePlan>,
	][] = [
		[
			"exact match within the date window",
			[line(10, 435)],
			[cand(1, 8, 435)],
			{ matches: [match(0, 1)] },
		],
		[
			"too far apart to match",
			[line(10, 435)],
			[cand(1, 6, 435)],
			{ create: [0], delete: [BigInt(1)] },
		],
		[
			"direction must agree",
			[{ ...line(10, 435), direction: inc }],
			[cand(1, 10, 435)],
			{ create: [0], delete: [BigInt(1)] },
		],
		[
			"two identical coffees pair by closest date",
			[line(10, 435), line(12, 435)],
			[cand(1, 12, 435), cand(2, 10, 435)],
			{ matches: [match(0, 2), match(1, 1)] },
		],
		[
			"tip changes the amount",
			[line(10, 5750)],
			[cand(1, 9, 5000)],
			{ matches: [match(0, 1, true)] },
		],
		[
			"exact beats near",
			[line(10, 5000)],
			[cand(1, 10, 4800), cand(2, 10, 5000)],
			{ matches: [match(0, 2)], delete: [BigInt(1)] },
		],
		[
			"ambiguous near matches are left alone",
			[line(10, 5750)],
			[cand(1, 10, 5000), cand(2, 11, 5100)],
			{ create: [0], delete: [BigInt(1), BigInt(2)] },
		],
		[
			"beyond the tolerance",
			[line(10, 10000)],
			[cand(1, 10, 7000)],
			{ create: [0], delete: [BigInt(1)] },
		],
		[
			"leftovers: manual, user data and grace window are kept",
			[],
			[
				cand(1, 10, 100, { source: manual }),
				cand(2, 10, 100, { hasUserData: true }),
				cand(3, 28, 100),
				cand(4, 10, 100),
			],
			{
				delete: [BigInt(4)],
				keep: [
					{ transactionId: BigInt(1), reason: K.MANUAL },
					{ transactionId: BigInt(2), reason: K.USER_DATA },
					{ transactionId: BigInt(3), reason: K.GRACE },
				],
			},
		],
		[
			"unmatched candidates outside the period are ignored",
			[],
			[{ ...cand(1, 1, 100), day: feb27 }],
			{},
		],
		[
			"line on the period end matches a transaction just after it",
			[line(31, 999)],
			[{ ...cand(1, 1, 999), day: apr2 }],
			{ matches: [match(0, 1)] },
		],
		[
			"re-parse: own transactions match the new lines like provisional ones",
			[line(10, 435)],
			[cand(1, 10, 435, { source: statement, fromStatement: true })],
			{ matches: [match(0, 1)] },
		],
		[
			"re-parse: own transactions the new lines leave out are deleted, unless they carry user data",
			[],
			[
				cand(1, 30, 100, { source: statement, fromStatement: true }),
				{
					...cand(2, 1, 100, { source: statement, fromStatement: true }),
					day: dayNumber(new Date(2026, 1, 20)),
				},
				cand(3, 10, 100, {
					source: statement,
					fromStatement: true,
					hasUserData: true,
				}),
			],
			{
				delete: [BigInt(1), BigInt(2)],
				keep: [{ transactionId: BigInt(3), reason: K.USER_DATA }],
			},
		],
	];

	for (const [name, lines, candidates, want] of cases)
		assert.deepEqual(
			planReconcile(lines, candidates, day(1), day(31)),
			{ ...empty, ...want },
			name,
		);
});

test("a demo statement upload previews and commits a real reconciliation", async () => {
	const chequing = db.accounts.find((a) => a.aliases.includes("5163878"));
	assert.ok(chequing);

	const preview = await statementClient.previewStatementImport({
		userId: "demo",
		pdfData: pdfNamed("chequing"),
		fileName: "chequing-missing-month.pdf",
	});
	assert.equal(preview.matchedAccountId, chequing.id);
	const actions = preview.reconciliation?.items.map((i) => i.action) ?? [];
	const count = (a: ReconciliationAction) =>
		actions.filter((x) => x === a).length;
	assert.equal(count(ReconciliationAction.UPDATE_AMOUNT), 1, "the tip");
	assert.ok(
		count(ReconciliationAction.CREATE) >= 1,
		"the fee no email announced",
	);
	assert.ok(count(ReconciliationAction.CONFIRM) > 0);
	assert.equal(preview.statement?.balanceOk, true);

	const statementId = preview.statement?.id;
	assert.ok(statementId);
	const r = await statementClient.commitStatementImport({
		userId: "demo",
		statementId,
		account: { case: "accountId", value: chequing.id },
	});
	assert.equal(r.confirmedCount, count(ReconciliationAction.CONFIRM));
	assert.equal(r.updatedCount, count(ReconciliationAction.UPDATE_AMOUNT));
	assert.equal(r.createdCount, count(ReconciliationAction.CREATE));
	assert.equal(r.deletedCount, count(ReconciliationAction.DELETE));
});

// core's TestPlanCoverage cases (nagomi-core internal/service/statement_coverage_test.go)
test("the demo plans statement coverage exactly like core", () => {
	const day = (m: number, d: number) => utcDay(2026, m, d);
	const S = StatementCoverageStatus;
	const stmt = (id: number, start: Date, end: Date, balanceOk?: boolean) => ({
		id: BigInt(id),
		start,
		end,
		balanceOk,
	});
	const imported = (id: number, start: Date, end: Date) => ({
		start,
		end,
		status: S.IMPORTED,
		statementId: BigInt(id),
	});
	const missing = (start: Date, end: Date) => ({
		start,
		end,
		status: S.MISSING,
	});
	const due = (start: Date, end: Date) => ({ start, end, status: S.DUE });

	const cases: [
		string,
		CoverageStatement[],
		CoverageSettings,
		Date,
		CoveragePeriod[],
	][] = [
		["nothing imported and no start", [], {}, day(3, 1), []],
		[
			"nothing imported: one stretch from the start",
			[],
			{ statementsStart: day(1, 1) },
			day(3, 1),
			[missing(day(1, 1), day(3, 1))],
		],
		[
			"nothing imported: the stretch stops at closing",
			[],
			{ statementsStart: day(1, 1), closedAt: day(2, 1) },
			day(3, 1),
			[missing(day(1, 1), day(2, 1))],
		],
		[
			"next period isn't due on its last day",
			[stmt(1, day(1, 15), day(2, 14))],
			{},
			day(3, 14),
			[imported(1, day(1, 15), day(2, 14))],
		],
		[
			"due the day after the period ends",
			[stmt(1, day(1, 15), day(2, 14))],
			{},
			day(3, 15),
			[imported(1, day(1, 15), day(2, 14)), due(day(2, 15), day(3, 14))],
		],
		[
			"several periods due",
			[stmt(1, day(1, 15), day(2, 14))],
			{},
			day(4, 20),
			[
				imported(1, day(1, 15), day(2, 14)),
				due(day(2, 15), day(3, 14)),
				due(day(3, 15), day(4, 14)),
			],
		],
		[
			"nothing due after closing",
			[stmt(1, day(1, 15), day(2, 14))],
			{ closedAt: day(3, 1) },
			day(6, 1),
			[imported(1, day(1, 15), day(2, 14)), due(day(2, 15), day(3, 14))],
		],
		[
			"gap between statements, a period per month",
			[stmt(1, day(1, 15), day(2, 14)), stmt(2, day(4, 15), day(5, 14))],
			{},
			day(5, 15),
			[
				imported(1, day(1, 15), day(2, 14)),
				missing(day(2, 15), day(3, 14)),
				missing(day(3, 15), day(4, 14)),
				imported(2, day(4, 15), day(5, 14)),
			],
		],
		[
			"gap shorter than a month at its end",
			[stmt(1, day(1, 15), day(2, 14)), stmt(2, day(3, 20), day(4, 19))],
			{},
			day(4, 20),
			[
				imported(1, day(1, 15), day(2, 14)),
				missing(day(2, 15), day(3, 14)),
				missing(day(3, 15), day(3, 19)),
				imported(2, day(3, 20), day(4, 19)),
			],
		],
		[
			"overlapping statements leave no gap",
			[stmt(1, day(1, 15), day(2, 14)), stmt(2, day(2, 1), day(2, 28))],
			{},
			day(3, 1),
			[imported(1, day(1, 15), day(2, 14)), imported(2, day(2, 1), day(2, 28))],
		],
		[
			"missing before the first statement, back to the start",
			[stmt(1, day(3, 15), day(4, 14))],
			{ statementsStart: day(1, 15) },
			day(4, 15),
			[
				missing(day(1, 15), day(2, 14)),
				missing(day(2, 15), day(3, 14)),
				imported(1, day(3, 15), day(4, 14)),
			],
		],
		[
			"a start inside the previous period doesn't expect it",
			[stmt(1, day(3, 15), day(4, 14))],
			{ statementsStart: day(2, 20) },
			day(4, 15),
			[imported(1, day(3, 15), day(4, 14))],
		],
		[
			"statement that doesn't add up",
			[stmt(1, day(1, 15), day(2, 14), false)],
			{},
			day(2, 15),
			[
				{
					start: day(1, 15),
					end: day(2, 14),
					status: S.UNBALANCED,
					statementId: BigInt(1),
				},
			],
		],
		[
			"month-end cycle keeps ending on the last day",
			[stmt(1, day(1, 1), day(1, 31))],
			{},
			day(4, 5),
			[
				imported(1, day(1, 1), day(1, 31)),
				due(day(2, 1), day(2, 28)),
				due(day(3, 1), day(3, 31)),
			],
		],
	];

	for (const [name, statements, settings, today, want] of cases)
		assert.deepEqual(planCoverage(statements, settings, today), want, name);
});

test("the demo account's coverage shows its missing month and the misread statement", async () => {
	const chequing = db.accounts.find((a) => a.aliases.includes("5163878"));
	assert.ok(chequing);
	// earlier tests may have imported the missing month; count what's left
	const { periods } = await statementClient.getStatementCoverage({
		userId: "demo",
		accountId: chequing.id,
	});
	const statuses = periods.map((p) => p.status);
	assert.ok(statuses.includes(StatementCoverageStatus.UNBALANCED));
	assert.ok(periods.every((p) => p.start && p.end));

	const { alerts } = await statementClient.listStatementAlerts({
		userId: "demo",
	});
	assert.ok(
		alerts.every((a) => a.period?.status !== StatementCoverageStatus.IMPORTED),
	);
	assert.ok(alerts.some((a) => a.accountId === chequing.id));
});

test("re-parsing the misread demo statement mends its balance and leaves its transactions", async () => {
	const misread = db.statements.find((s) => s.balanceOk === false);
	assert.ok(misread);
	const txCount = db.transactions.length;

	const dry = await statementClient.reparseStatement({
		userId: "demo",
		id: misread.id,
		apply: false,
	});
	assert.equal(dry.statement?.balanceOk, true);
	assert.equal(misread.balanceOk, false, "a dry run writes nothing");
	assert.ok(
		dry.reconciliation?.items.every(
			(i) => i.action === ReconciliationAction.ALREADY_IMPORTED,
		),
	);

	await statementClient.reparseStatement({
		userId: "demo",
		id: misread.id,
		apply: true,
	});
	assert.equal(misread.balanceOk, true);
	assert.equal(db.transactions.length, txCount);
});
