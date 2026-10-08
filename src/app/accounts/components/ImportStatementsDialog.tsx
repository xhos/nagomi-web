"use client";

import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";
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
	// account id, NEW_ACCOUNT, or "" while unchosen
	target: string;
	newName: string;
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
	const [importing, setImporting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	// latest items for reads that finish after other files were already chosen
	const itemsRef = useRef(items);
	itemsRef.current = items;

	// core only imports into statement-driven accounts
	const targets = accounts.filter((a) => a.statementDriven);

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
			const s = preview.statement;
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
				newName:
					sibling?.newName ??
					(s
						? [
								s.bank,
								accountTypeName(s.accountType),
								s.accountNumber.slice(-4),
							]
								.filter(Boolean)
								.join(" ")
						: ""),
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
				newName: "",
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
		if (target === "" || target === NEW_ACCOUNT || !userId || !statementId) {
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
	const canImport =
		!importing &&
		ready.length > 0 &&
		!items.some((x) => x.status === "reading") &&
		ready.every(
			(x) =>
				x.target !== "" &&
				!x.planning &&
				(x.target !== NEW_ACCOUNT || x.newName.trim() !== ""),
		);

	const importAll = async () => {
		if (!userId) return;
		setImporting(true);
		// several statements for one new account should land in the same account
		const created = new Map<string, bigint>();
		for (const item of ready) {
			const statementId = item.preview?.statement?.id;
			if (statementId === undefined) continue;
			const name = item.newName.trim();
			const target: StatementTarget =
				item.target !== NEW_ACCOUNT
					? { accountId: BigInt(item.target) }
					: created.has(name)
						? { accountId: created.get(name) as bigint }
						: { newAccountName: name };

			update(item.key, { status: "importing", error: undefined });
			try {
				const r = await statementsApi.commit(userId, statementId, target);
				if (item.target === NEW_ACCOUNT && r.statement?.accountId)
					created.set(name, r.statement.accountId);
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
						<ul className="max-h-[50vh] overflow-y-auto border-t">
							{items.map((item) => (
								<StatementItem
									key={item.key}
									item={item}
									accounts={targets}
									busy={importing}
									onChange={(patch) => {
										for (const x of group(item)) update(x.key, patch);
									}}
									onChoose={(target) => {
										for (const x of group(item)) choose(x, target);
									}}
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
	busy,
	onChange,
	onChoose,
	onRemove,
}: {
	item: Item;
	accounts: Account[];
	busy: boolean;
	onChange: (patch: Partial<Item>) => void;
	onChoose: (target: string) => void;
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
		<li className="border-b py-3">
			<div className="flex items-start gap-3">
				<div className="min-w-0 flex-1">
					<div className="truncate font-medium">{title}</div>
					{meta && (
						<div className="truncate text-sm text-muted-foreground">{meta}</div>
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
							<option value={NEW_ACCOUNT}>New account…</option>
						</NativeSelect>
						{item.target === NEW_ACCOUNT && (
							<Input
								aria-label="New account name"
								value={item.newName}
								onChange={(e) => onChange({ newName: e.target.value })}
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
					{item.target === NEW_ACCOUNT && (
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
