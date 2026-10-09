"use client";

import { Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { FormError, NativeSelect } from "@/components/ui/forms";
import { Input } from "@/components/ui/input";
import type { Account } from "@/gen/nagomi/v1/account_pb";
import type {
	PreviewStatementImportResponse,
	StatementReconciliation,
} from "@/gen/nagomi/v1/statement_services_pb";
import { useUserId } from "@/hooks/useSession";
import { useInvalidateStatementData } from "@/hooks/useStatements";
import {
	isAlreadyImported,
	type StatementTarget,
	statementErrorMessage,
	statementsApi,
} from "@/lib/api/statements";
import { accountTypeName } from "@/lib/utils/account";
import { periodLabel } from "@/lib/utils/statement";
import { ReconciliationSummary } from "./ReconciliationSummary";

const MAX_BYTES = 20 * 1024 * 1024;
const NEW_ACCOUNT = "new";
// an account this import creates; statements choose it as DRAFT + its key
const DRAFT = "draft:";

type Draft = { key: string; name: string };

type Item = {
	key: string;
	file: File;
	status:
		| "reading"
		| "ready"
		| "duplicate"
		| "failed"
		| "importing"
		| "imported";
	preview?: PreviewStatementImportResponse;
	// account id, DRAFT + draft key, or "" while unchosen
	target: string;
	error?: string;
	// what committing into target does; the preview's when target is the matched account
	plan?: StatementReconciliation;
	planning?: boolean;
	result?: string;
};

// statements of one account share bank, type and number; without a number they
// can't be told apart, so they aren't grouped
const accountKey = (preview?: PreviewStatementImportResponse) => {
	const s = preview?.statement;
	return s?.accountNumber
		? `${s.bank}|${s.accountType}|${s.accountNumber}`
		: undefined;
};

const defaultName = (preview?: PreviewStatementImportResponse) => {
	const s = preview?.statement;
	return s
		? [s.bank, accountTypeName(s.accountType), s.accountNumber.slice(-4)]
				.filter(Boolean)
				.join(" ")
		: "";
};

const period = (preview: PreviewStatementImportResponse) =>
	periodLabel(preview.statement?.periodStart, preview.statement?.periodEnd);

// "14 confirmed, 1 updated, 2 added and 1 deleted in chequing."
function resultSentence(
	r: {
		confirmedCount: number;
		updatedCount: number;
		createdCount: number;
		deletedCount: number;
		keptCount: number;
	},
	accountName: string,
) {
	const parts = [
		[r.confirmedCount, "confirmed"],
		[r.updatedCount, "updated"],
		[r.createdCount, "added"],
		[r.deletedCount, "deleted"],
		[r.keptCount, "kept"],
	]
		.filter(([n]) => (n as number) > 0)
		.map(([n, label]) => `${n} ${label}`);
	if (parts.length === 0) return `Nothing changed in ${accountName}.`;
	const list =
		parts.length === 1
			? parts[0]
			: `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
	return `${list[0].toUpperCase()}${list.slice(1)} in ${accountName}.`;
}

interface ImportStatementsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	accounts: Account[];
}

export function ImportStatementsDialog({
	open,
	onOpenChange,
	accounts,
}: ImportStatementsDialogProps) {
	const userId = useUserId();
	const invalidate = useInvalidateStatementData();
	const [items, setItems] = useState<Item[]>([]);
	const [drafts, setDrafts] = useState<Draft[]>([]);
	const [importing, setImporting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	// latest items for reads that finish after other files were already chosen
	const itemsRef = useRef(items);
	itemsRef.current = items;

	// core only imports into statement-driven accounts
	const targets = accounts.filter((a) => a.statementDriven);

	const draftOf = (target: string) =>
		drafts.find((d) => `${DRAFT}${d.key}` === target);

	const update = (key: string, patch: Partial<Item>) =>
		setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

	const read = async (item: Item) => {
		if (!userId) return;
		try {
			const preview = await statementsApi.preview(
				userId,
				new Uint8Array(await item.file.arrayBuffer()),
				item.file.name,
			);
			const matched = targets.find((a) => a.id === preview.matchedAccountId);
			const key = accountKey(preview);
			const sibling = matched
				? undefined
				: itemsRef.current.find(
						(x) =>
							x.key !== item.key &&
							x.status === "ready" &&
							x.target !== "" &&
							key !== undefined &&
							accountKey(x.preview) === key,
					);
			update(item.key, {
				status: "ready",
				preview,
				plan: matched ? preview.reconciliation : undefined,
				target: matched?.id.toString() ?? "",
			});
			if (sibling) choose({ ...item, preview }, sibling.target);
		} catch (e) {
			update(
				item.key,
				isAlreadyImported(e)
					? { status: "duplicate" }
					: {
							status: "failed",
							error: statementErrorMessage(e, "Couldn't read this file."),
						},
			);
		}
	};

	const addFiles = (files: FileList | File[]) => {
		setError(null);
		const added: Item[] = [];
		for (const file of Array.from(files)) {
			const isPdf =
				file.type === "application/pdf" ||
				file.name.toLowerCase().endsWith(".pdf");
			if (!isPdf) {
				setError(`${file.name} isn't a PDF.`);
				continue;
			}
			if (file.size > MAX_BYTES) {
				setError(`${file.name} is over 20MB.`);
				continue;
			}
			added.push({
				key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
				file,
				status: "reading",
				target: "",
			});
		}
		setItems((xs) => [...xs, ...added]);
		for (const item of added) read(item);
	};

	// a different account than the one the preview planned against needs its own plan
	const choose = async (item: Item, target: string) => {
		const preview = item.preview;
		const statementId = preview?.statement?.id;
		const planned = preview?.reconciliation;
		if (target === "" || target.startsWith(DRAFT) || !userId || !statementId) {
			update(item.key, { target, plan: undefined, planning: false });
			return;
		}
		if (planned && planned.accountId.toString() === target) {
			update(item.key, { target, plan: planned, planning: false });
			return;
		}
		update(item.key, { target, plan: undefined, planning: true });
		try {
			const plan = await statementsApi.plan(
				userId,
				statementId,
				BigInt(target),
			);
			setItems((xs) =>
				xs.map((x) =>
					x.key === item.key && x.target === target
						? { ...x, plan, planning: false }
						: x,
				),
			);
		} catch (e) {
			update(item.key, {
				planning: false,
				error: statementErrorMessage(e, "Couldn't plan this import."),
			});
		}
	};

	// a choice made on one statement applies to the others from its account,
	// except ones core already matched to an existing account
	const group = (item: Item) => {
		const key = accountKey(item.preview);
		return items.filter(
			(x) =>
				x.key === item.key ||
				(key !== undefined &&
					x.status === "ready" &&
					accountKey(x.preview) === key &&
					!targets.some((a) => a.id === x.preview?.matchedAccountId)),
		);
	};

	const ready = items.filter((x) => x.status === "ready");
	const unchosen = ready.filter(
		(x) => x.target === "" || draftOf(x.target)?.name.trim() === "",
	);
	const reading = items.some((x) => x.status === "reading");
	const canImport =
		!importing &&
		ready.length > 0 &&
		unchosen.length === 0 &&
		!reading &&
		!ready.some((x) => x.planning);
	// drafts no statement points at anymore drop out of the choices
	const liveDrafts = drafts.filter((d) =>
		items.some((x) => x.target === `${DRAFT}${d.key}`),
	);

	// after the render that shows it, so a new account's name field exists
	const focusRow = (key: string, field: "select" | "input") =>
		requestAnimationFrame(() => {
			const row = listRef.current?.querySelector<HTMLElement>(
				`[data-key="${CSS.escape(key)}"]`,
			);
			row?.scrollIntoView({ block: "center", behavior: "smooth" });
			row?.querySelector<HTMLElement>(field)?.focus({ preventScroll: true });
		});

	// on to the next statement still without an account, wrapping around;
	// `done` are the ones just chosen, which state doesn't reflect yet
	const advance = (from: Item, done: Item[]) => {
		const left = unchosen.filter((x) => !done.includes(x));
		const at = items.indexOf(from);
		const next = left.find((x) => items.indexOf(x) > at) ?? left[0];
		if (next) focusRow(next.key, "select");
	};

	// once files finish reading, start at the first one that needs an account
	const wasReading = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when reading ends
	useEffect(() => {
		const first = unchosen[0];
		if (
			wasReading.current &&
			!reading &&
			first &&
			!listRef.current?.contains(document.activeElement)
		)
			focusRow(first.key, "select");
		wasReading.current = reading;
	}, [reading]);

	const pick = (item: Item, value: string) => {
		const chosen = group(item);
		if (value === NEW_ACCOUNT) {
			const draft = {
				key: `${Date.now()}-${Math.random()}`,
				name: defaultName(item.preview),
			};
			setDrafts((ds) => [...ds, draft]);
			for (const x of chosen) choose(x, `${DRAFT}${draft.key}`);
			focusRow(item.key, "input");
			return;
		}
		for (const x of chosen) choose(x, value);
		advance(item, chosen);
	};

	const rename = (target: string, name: string) =>
		setDrafts((ds) =>
			ds.map((d) => (`${DRAFT}${d.key}` === target ? { ...d, name } : d)),
		);

	const importAll = async () => {
		if (!userId) return;
		setImporting(true);
		// the first statement of a draft creates its account; the rest join it
		const created = new Map<string, bigint>();
		for (const item of ready) {
			const statementId = item.preview?.statement?.id;
			if (statementId === undefined) continue;
			const draft = draftOf(item.target);
			const target: StatementTarget = !draft
				? { accountId: BigInt(item.target) }
				: created.has(draft.key)
					? { accountId: created.get(draft.key) as bigint }
					: { newAccountName: draft.name.trim() };

			update(item.key, { status: "importing", error: undefined });
			try {
				const r = await statementsApi.commit(userId, statementId, target);
				if (draft && r.statement?.accountId)
					created.set(draft.key, r.statement.accountId);
				update(item.key, {
					status: "imported",
					result: resultSentence(r, r.statement?.accountName ?? "the account"),
				});
			} catch (e) {
				update(item.key, {
					status: "ready",
					error: statementErrorMessage(e, "Couldn't import this statement."),
				});
			}
		}
		setImporting(false);
		invalidate();
	};

	const close = () => {
		if (importing) return;
		setItems([]);
		setDrafts([]);
		setError(null);
		onOpenChange(false);
	};

	const done =
		items.length > 0 &&
		items.every((x) => ["imported", "duplicate", "failed"].includes(x.status));

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>import statements</DialogTitle>
				</DialogHeader>

				<div className="min-w-0 space-y-4">
					<button
						type="button"
						onDrop={(e) => {
							e.preventDefault();
							addFiles(e.dataTransfer.files);
						}}
						onDragOver={(e) => e.preventDefault()}
						onClick={() => fileInputRef.current?.click()}
						className="w-full rounded-md border border-dashed p-6 text-center transition-colors hover:bg-muted/60"
					>
						<Upload className="mx-auto mb-2 size-4 text-muted-foreground" />
						<p className="text-sm">Drop PDF statements or click to choose</p>
						<p className="mt-1 text-sm text-muted-foreground">
							RBC chequing, savings, and Visa
						</p>
						<input
							ref={fileInputRef}
							type="file"
							accept="application/pdf,.pdf"
							multiple
							onChange={(e) => {
								if (e.target.files) addFiles(e.target.files);
								e.target.value = "";
							}}
							className="hidden"
						/>
					</button>

					<FormError>{error}</FormError>

					{items.length > 0 && (
						<ul ref={listRef} className="max-h-[50vh] overflow-y-auto border-t">
							{items.map((item) => (
								<StatementItem
									key={item.key}
									item={item}
									accounts={targets}
									drafts={liveDrafts}
									draft={draftOf(item.target)}
									busy={importing}
									onChoose={(value) => pick(item, value)}
									onRename={(name) => rename(item.target, name)}
									onNext={() => advance(item, [item])}
									onRemove={() =>
										setItems((xs) => xs.filter((x) => x.key !== item.key))
									}
								/>
							))}
						</ul>
					)}
				</div>

				<DialogFooter>
					{done ? (
						<Button onClick={close}>Done</Button>
					) : (
						<>
							<Button variant="outline" onClick={close} disabled={importing}>
								Cancel
							</Button>
							<Button onClick={importAll} disabled={!canImport}>
								{importing ? "Importing…" : "Import"}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function StatementItem({
	item,
	accounts,
	drafts,
	draft,
	busy,
	onChoose,
	onRename,
	onNext,
	onRemove,
}: {
	item: Item;
	accounts: Account[];
	drafts: Draft[];
	// the new account this statement goes into, if it's one
	draft?: Draft;
	busy: boolean;
	onChoose: (value: string) => void;
	onRename: (name: string) => void;
	onNext: () => void;
	onRemove: () => void;
}) {
	const s = item.preview?.statement;
	const title = (item.preview && period(item.preview)) ?? item.file.name;
	const meta = s
		? [s.bank, accountTypeName(s.accountType), s.accountNumber, item.file.name]
				.filter(Boolean)
				.join(" · ")
		: null;
	const lineCount = s?.lineCount ?? 0;

	return (
		<li className="scroll-my-2 border-b py-3" data-key={item.key}>
			<div className="flex items-start gap-3">
				<div className="min-w-0 flex-1">
					<div className="truncate font-medium" title={title}>
						{title}
					</div>
					{meta && (
						<div
							className="truncate text-sm text-muted-foreground"
							title={meta}
						>
							{meta}
						</div>
					)}
				</div>
				{s && (
					<span className="shrink-0 text-sm text-muted-foreground tabular-nums">
						{lineCount} {lineCount === 1 ? "transaction" : "transactions"}
					</span>
				)}
				{item.status !== "importing" && item.status !== "imported" && (
					<Button
						size="icon-sm"
						variant="ghost"
						aria-label="Remove file"
						onClick={onRemove}
						disabled={busy}
						className="-my-1"
					>
						<X />
					</Button>
				)}
			</div>

			{item.status === "reading" && (
				<p className="mt-1 text-sm text-muted-foreground">Reading…</p>
			)}
			{item.status === "duplicate" && (
				<p className="mt-1 text-sm text-muted-foreground">
					This statement was already imported.
				</p>
			)}
			{item.status === "failed" && (
				<p className="mt-1 text-sm text-destructive">{item.error}</p>
			)}
			{item.status === "importing" && (
				<p className="mt-1 text-sm text-muted-foreground">Importing…</p>
			)}
			{item.status === "imported" && item.result && (
				<p className="mt-1 text-sm text-muted-foreground">{item.result}</p>
			)}

			{item.status === "ready" && (
				<div className="mt-2 space-y-2">
					<div className="flex flex-col gap-2 sm:flex-row">
						<NativeSelect
							aria-label="Account"
							value={item.target}
							onChange={(e) => onChoose(e.target.value)}
							disabled={busy}
							className="sm:flex-1"
						>
							<option value="" disabled>
								Choose account…
							</option>
							{accounts.map((a) => (
								<option key={a.id.toString()} value={a.id.toString()}>
									{a.friendlyName || a.name}
								</option>
							))}
							{drafts.map((d) => (
								<option key={d.key} value={`${DRAFT}${d.key}`}>
									{d.name.trim() || "Unnamed"} (new)
								</option>
							))}
							<option value={NEW_ACCOUNT}>New account…</option>
						</NativeSelect>
						{draft && (
							<Input
								aria-label="New account name"
								placeholder="Account name"
								value={draft.name}
								onChange={(e) => onRename(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") onNext();
								}}
								disabled={busy}
								className="h-9 sm:flex-1"
							/>
						)}
					</div>
					{s?.balanceOk === false && (
						<p className="text-sm">
							Its lines don't add up to the statement's balances, so some may
							have been misread.
						</p>
					)}
					{item.planning && (
						<p className="text-sm text-muted-foreground">Checking…</p>
					)}
					{item.plan && item.preview && (
						<ReconciliationSummary
							reconciliation={item.plan}
							lines={item.preview.lines}
							currency={s?.currency ?? "CAD"}
						/>
					)}
					{draft && (
						<p className="text-sm text-muted-foreground">
							{lineCount === 1
								? "Its 1 transaction is added."
								: `All ${lineCount} transactions are added.`}
						</p>
					)}
					{item.error && (
						<p className="text-sm text-destructive">{item.error}</p>
					)}
				</div>
			)}
		</li>
	);
}
