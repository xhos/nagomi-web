"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
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
import type { Account } from "@/gen/nagomi/v1/account_pb";
import {
	TransactionDirection,
	TransactionSource,
} from "@/gen/nagomi/v1/enums_pb";
import { useUserId } from "@/hooks/useSession";
import { transactionsApi } from "@/lib/api/transactions";
import {
	accountNumberMatches,
	dayKey,
	dayNumber,
	type ExistingTx,
	parseRbcCsv,
	type RbcRow,
	splitNew,
} from "@/lib/rbc-csv";
import { accountTypeName } from "@/lib/utils/account";
import { formatAmount } from "@/lib/utils/transaction";

const MAX_BYTES = 5 * 1024 * 1024;
const SKIP = "";
// the dedupe pairs neighbouring days, so look a little past the file's range
const PAD_DAYS = 3;
const DAY_MS = 86_400_000;

type Group = {
	key: string;
	label: string;
	rows: RbcRow[];
	// account id, or SKIP while unchosen
	target: string;
	planning: boolean;
	fresh?: RbcRow[];
	duplicates?: RbcRow[];
	error?: string;
	status: "ready" | "importing" | "imported";
};

const plural = (n: number, one: string, many: string) =>
	`${n} ${n === 1 ? one : many}`;

// every transaction the account has around the file's dates, as signed cents
async function existingFor(
	userId: string,
	accountId: bigint,
	rows: RbcRow[],
): Promise<ExistingTx[]> {
	const days = rows.map((r) => dayNumber(r.day));
	const startDate = new Date((Math.min(...days) - PAD_DAYS) * DAY_MS);
	const endDate = new Date((Math.max(...days) + PAD_DAYS + 1) * DAY_MS);
	const out: ExistingTx[] = [];
	let cursor: Awaited<ReturnType<typeof transactionsApi.list>>["nextCursor"];
	for (;;) {
		const page = await transactionsApi.list({
			userId,
			accountId,
			startDate,
			endDate,
			limit: 1000,
			cursor,
		});
		for (const tx of page.transactions) {
			if (!tx.txDate) continue;
			const cents = Math.round(formatAmount(tx.txAmount) * 100);
			const incoming = tx.direction === TransactionDirection.DIRECTION_INCOMING;
			out.push({
				day: dayKey(new Date(Number(tx.txDate.seconds) * 1000)),
				cents: incoming ? Math.abs(cents) : -Math.abs(cents),
			});
		}
		if (!page.hasMore) return out;
		cursor = page.nextCursor;
	}
}

interface ImportCsvDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	accounts: Account[];
}

export function ImportCsvDialog({
	open,
	onOpenChange,
	accounts,
}: ImportCsvDialogProps) {
	const userId = useUserId();
	const queryClient = useQueryClient();
	const [fileName, setFileName] = useState<string | null>(null);
	const [groups, setGroups] = useState<Group[]>([]);
	const [skipped, setSkipped] = useState(0);
	const [importing, setImporting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const update = (key: string, patch: Partial<Group>) =>
		setGroups((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

	// what the file adds to this account once what it already has is set aside
	const plan = async (group: Group, target: string) => {
		if (!userId || target === SKIP) {
			update(group.key, {
				target,
				planning: false,
				fresh: undefined,
				duplicates: undefined,
				error: undefined,
			});
			return;
		}
		update(group.key, { target, planning: true, error: undefined });
		try {
			const existing = await existingFor(userId, BigInt(target), group.rows);
			const { fresh, duplicates } = splitNew(group.rows, existing);
			setGroups((xs) =>
				xs.map((x) =>
					x.key === group.key && x.target === target
						? { ...x, planning: false, fresh, duplicates }
						: x,
				),
			);
		} catch {
			update(group.key, {
				planning: false,
				error: "Couldn't check this account's transactions.",
			});
		}
	};

	const addFile = async (file: File) => {
		setError(null);
		if (!file.name.toLowerCase().endsWith(".csv")) {
			setError(`${file.name} isn't a CSV.`);
			return;
		}
		if (file.size > MAX_BYTES) {
			setError(`${file.name} is over 5MB.`);
			return;
		}
		const parsed = parseRbcCsv(await file.text());
		if (!parsed) {
			setError("This doesn't look like an RBC transaction export.");
			return;
		}
		if (parsed.rows.length === 0) {
			setError("This file has no transactions.");
			return;
		}

		const byAccount = new Map<string, RbcRow[]>();
		for (const row of parsed.rows)
			byAccount.set(row.accountNumber, [
				...(byAccount.get(row.accountNumber) ?? []),
				row,
			]);
		const matches = new Map<string, string>();
		const next: Group[] = [...byAccount].map(([number, rows]) => {
			const match = accounts.find((a) =>
				a.aliases.some((alias) => accountNumberMatches(number, alias)),
			);
			if (match) matches.set(number, match.id.toString());
			return {
				key: number,
				label: `${rows[0].accountType} · ${number}`,
				rows,
				target: SKIP,
				planning: false,
				status: "ready",
			};
		});
		setFileName(file.name);
		setSkipped(parsed.skipped);
		setGroups(next);
		for (const g of next) {
			const target = matches.get(g.key);
			if (target) plan(g, target);
		}
	};

	const ready = groups.filter(
		(g) => g.status === "ready" && g.target !== SKIP && g.fresh,
	);
	const canImport =
		!importing &&
		ready.some((g) => (g.fresh?.length ?? 0) > 0) &&
		!groups.some((g) => g.planning);

	const importAll = async () => {
		if (!userId) return;
		setImporting(true);
		for (const g of ready) {
			if (!g.fresh?.length) continue;
			update(g.key, { status: "importing", error: undefined });
			try {
				await transactionsApi.bulkCreate(
					userId,
					g.fresh.map((r) => {
						const [y, m, d] = r.day.split("-").map(Number);
						return {
							accountId: BigInt(g.target),
							// noon, so a time zone shift can't move it to another day
							txDate: new Date(y, m - 1, d, 12),
							txAmount: {
								currencyCode: r.currency,
								units: String(Math.trunc(Math.abs(r.cents) / 100)),
								nanos: (Math.abs(r.cents) % 100) * 10_000_000,
							},
							direction:
								r.cents > 0
									? TransactionDirection.DIRECTION_INCOMING
									: TransactionDirection.DIRECTION_OUTGOING,
							description: r.description,
							// TODO: no csv source in core; email stays provisional so a later statement confirms these instead of duplicating them
							source: TransactionSource.EMAIL,
						};
					}),
				);
				update(g.key, { status: "imported" });
			} catch {
				update(g.key, {
					status: "ready",
					error: "Couldn't import these transactions.",
				});
			}
		}
		setImporting(false);
		for (const key of ["accounts", "accountBalance", "transactions"])
			queryClient.invalidateQueries({ queryKey: [key] });
	};

	const close = () => {
		if (importing) return;
		setFileName(null);
		setGroups([]);
		setError(null);
		onOpenChange(false);
	};

	const done =
		groups.length > 0 && groups.every((g) => g.status === "imported");

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>import csv</DialogTitle>
				</DialogHeader>

				<div className="min-w-0 space-y-4">
					<button
						type="button"
						onDrop={(e) => {
							e.preventDefault();
							const file = e.dataTransfer.files[0];
							if (file) addFile(file);
						}}
						onDragOver={(e) => e.preventDefault()}
						onClick={() => fileInputRef.current?.click()}
						disabled={importing}
						className="w-full rounded-md border border-dashed p-6 text-center transition-colors hover:bg-muted/60"
					>
						<Upload className="mx-auto mb-2 size-4 text-muted-foreground" />
						<p className="text-sm">
							{fileName ?? "Drop a CSV export or click to choose"}
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							Recent RBC transactions, downloaded from online banking
						</p>
						<input
							ref={fileInputRef}
							type="file"
							accept="text/csv,.csv"
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (file) addFile(file);
								e.target.value = "";
							}}
							className="hidden"
						/>
					</button>

					<FormError>{error}</FormError>

					{groups.length > 0 && (
						<ul className="max-h-[50vh] overflow-y-auto border-t">
							{groups.map((g) => (
								<li key={g.key} className="border-b py-3">
									<div className="flex items-start gap-3">
										<div className="min-w-0 flex-1 truncate font-medium">
											{g.label}
										</div>
										<span className="shrink-0 text-sm text-muted-foreground tabular-nums">
											{plural(g.rows.length, "transaction", "transactions")}
										</span>
									</div>
									{g.status === "imported" ? (
										<p className="mt-1 text-sm text-muted-foreground">
											{plural(
												g.fresh?.length ?? 0,
												"transaction",
												"transactions",
											)}{" "}
											added.
										</p>
									) : (
										<div className="mt-2 space-y-2">
											<NativeSelect
												aria-label="Account"
												value={g.target}
												onChange={(e) => plan(g, e.target.value)}
												disabled={importing}
											>
												<option value={SKIP}>Don't import…</option>
												{accounts.map((a) => (
													<option key={a.id.toString()} value={a.id.toString()}>
														{a.friendlyName || a.name} ·{" "}
														{accountTypeName(a.type)}
													</option>
												))}
											</NativeSelect>
											{g.planning && (
												<p className="text-sm text-muted-foreground">
													Checking…
												</p>
											)}
											{g.fresh && g.duplicates && (
												<p className="text-sm text-muted-foreground">
													{g.fresh.length === 0
														? "Nothing new."
														: `${g.fresh.length} new`}
													{g.duplicates.length > 0 &&
														`${g.fresh.length === 0 ? " " : ", "}${g.duplicates.length} already in the account`}
													.
												</p>
											)}
											{g.error && (
												<p className="text-sm text-destructive">{g.error}</p>
											)}
										</div>
									)}
								</li>
							))}
						</ul>
					)}
					{skipped > 0 && (
						<p className="text-sm text-muted-foreground">
							{plural(skipped, "row was", "rows were")} skipped because{" "}
							{skipped === 1 ? "it" : "they"} couldn't be read.
						</p>
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
