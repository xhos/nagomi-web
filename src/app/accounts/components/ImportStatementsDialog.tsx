"use client";

import { format } from "date-fns";
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
import type { Date as ProtoDate } from "@/gen/google/type/date_pb";
import type { Account } from "@/gen/nagomi/v1/account_pb";
import { AccountType } from "@/gen/nagomi/v1/enums_pb";
import type { PreviewStatementImportResponse } from "@/gen/nagomi/v1/statement_services_pb";
import { useUserId } from "@/hooks/useSession";
import { useInvalidateStatementData } from "@/hooks/useStatements";
import {
	isAlreadyImported,
	type StatementTarget,
	statementErrorMessage,
	statementsApi,
} from "@/lib/api/statements";
import { accountTypeName } from "@/lib/utils/account";

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
	result?: { created: number; skipped: number; accountName: string };
};

const day = (d?: ProtoDate) =>
	d ? new Date(d.year, d.month - 1, d.day) : null;

function period(preview: PreviewStatementImportResponse) {
	const from = day(preview.statement?.periodStart);
	const to = day(preview.statement?.periodEnd);
	if (!from || !to) return null;
	const sameYear = from.getFullYear() === to.getFullYear();
	return `${format(from, sameYear ? "MMM d" : "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
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

	const targets = accounts.filter((a) => a.type !== AccountType.ACCOUNT_FRIEND);

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
			update(item.key, {
				status: "ready",
				preview,
				target: preview.matchedAccountId?.toString() ?? "",
				newName: s ? `${s.bank} ${accountTypeName(s.accountType)}` : "",
			});
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

	const ready = items.filter((x) => x.status === "ready");
	const canImport =
		!importing &&
		ready.length > 0 &&
		!items.some((x) => x.status === "reading") &&
		ready.every(
			(x) =>
				x.target !== "" &&
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
					result: {
						created: r.createdCount,
						skipped: r.duplicateCount,
						accountName: r.statement?.accountName ?? "",
					},
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

				<div className="space-y-4">
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
									onChange={(patch) => update(item.key, patch)}
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
	onRemove,
}: {
	item: Item;
	accounts: Account[];
	busy: boolean;
	onChange: (patch: Partial<Item>) => void;
	onRemove: () => void;
}) {
	const s = item.preview?.statement;
	const title = (item.preview && period(item.preview)) ?? item.file.name;
	const meta = s
		? [s.bank, accountTypeName(s.accountType), s.accountNumber, item.file.name]
				.filter(Boolean)
				.join(" · ")
		: null;
	const matched =
		item.preview?.matchedAccountId !== undefined &&
		item.target === item.preview.matchedAccountId.toString();
	const duplicates = item.preview?.duplicateCount ?? 0;
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
				<p className="mt-1 text-sm text-muted-foreground">
					Added {item.result.created} to {item.result.accountName}
					{item.result.skipped > 0 &&
						`, ${item.result.skipped} were already there`}
					.
				</p>
			)}

			{item.status === "ready" && (
				<div className="mt-2 space-y-2">
					<div className="flex flex-col gap-2 sm:flex-row">
						<NativeSelect
							aria-label="Account"
							value={item.target}
							onChange={(e) => onChange({ target: e.target.value })}
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
					{matched && duplicates > 0 && (
						<p className="text-sm text-muted-foreground">
							{duplicates === lineCount
								? "All of these are already in this account."
								: `${duplicates} of these are already in this account.`}
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
