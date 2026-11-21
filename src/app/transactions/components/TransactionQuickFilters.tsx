"use client";

import { X } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { MultiSelect } from "@/components/ui/forms";
import type { Account } from "@/gen/nagomi/v1/account_pb";
import { useAccounts } from "@/hooks/useAccounts";
import { cn } from "@/lib/utils";
import {
	accountName,
	accountOptionsOf,
	amountLabel,
	categoryLabel,
	dateLabel,
	directionLabel,
	hasAnyFilter,
	isQuickAccount,
	sortAccounts,
	type TransactionFilters,
} from "./TransactionFiltersPanel";

interface TransactionQuickFiltersProps {
	filters: TransactionFilters;
	onFiltersChange: (filters: TransactionFilters) => void;
	// the advanced panel shows its own state; the summary chips are for when it's closed
	panelOpen: boolean;
	onOpenPanel: () => void;
}

const GAP = 8;
// room kept for the "+N" chip whenever some accounts don't fit
const MORE_WIDTH = 48;

function AccountChip({
	account,
	on,
	onClick,
}: {
	account: Account;
	on: boolean;
	onClick?: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onClick}
			tabIndex={onClick ? undefined : -1}
			style={
				{
					"--c": account.color || "var(--muted-foreground)",
				} as React.CSSProperties
			}
			className={cn(
				"h-7 shrink-0 whitespace-nowrap rounded-full border px-3 text-sm transition-colors",
				on
					? "border-(--c) bg-muted text-foreground"
					: "border-[color-mix(in_oklab,var(--c)_35%,transparent)] text-muted-foreground hover:border-[color-mix(in_oklab,var(--c)_70%,transparent)] hover:text-foreground",
			)}
		>
			{accountName(account)}
		</button>
	);
}

// how many chips of these widths fit in `room`, leaving space for "+N" when some don't
function countFitting(widths: number[], room: number) {
	const total = widths.reduce((sum, w, i) => sum + w + (i ? GAP : 0), 0);
	if (total <= room) return widths.length;
	let used = 0;
	let n = 0;
	for (const w of widths) {
		const next = used + (n ? GAP : 0) + w;
		if (next + GAP + MORE_WIDTH > room) break;
		used = next;
		n++;
	}
	return n;
}

// one tap scopes the list to accounts; whatever the panel filters by stays visible here,
// so a closed panel never hides why rows are missing. always one line: accounts that
// don't fit fold into a "+N" chip that opens the full list
export function TransactionQuickFilters({
	filters,
	onFiltersChange,
	panelOpen,
	onOpenPanel,
}: TransactionQuickFiltersProps) {
	const { accounts } = useAccounts();
	const selected = filters.accountIds ?? [];
	// closed and friend accounts only get a chip while they're picked
	const shown = sortAccounts(accounts).filter(
		(a) => isQuickAccount(a) || selected.includes(a.id.toString()),
	);
	const options = useMemo(() => accountOptionsOf(accounts), [accounts]);

	const rowRef = useRef<HTMLDivElement>(null);
	const measureRef = useRef<HTMLDivElement>(null);
	const restRef = useRef<HTMLDivElement>(null);
	const [fit, setFit] = useState(shown.length);
	const shownKey = shown.map((a) => a.id).join();

	const summaries: [string, string | null, Partial<TransactionFilters>][] =
		panelOpen
			? []
			: [
					[
						"date",
						dateLabel(filters),
						{ startDate: undefined, endDate: undefined },
					],
					[
						"category",
						categoryLabel(filters),
						{ categories: undefined, uncategorized: undefined },
					],
					[
						"amount",
						amountLabel(filters),
						{ amountMin: undefined, amountMax: undefined },
					],
					["direction", directionLabel(filters), { direction: undefined }],
				];
	const active = summaries.filter(([, label]) => label);
	const accountChips = shown.length > 1 || selected.length > 0;
	const restKey = `${active.map(([, l]) => l).join()}|${hasAnyFilter(filters)}`;

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the chips or the right side change
	useLayoutEffect(() => {
		const row = rowRef.current;
		const measure = measureRef.current;
		if (!row || !measure) return;
		const calc = () => {
			const widths = [...measure.children].map(
				(c) => (c as HTMLElement).offsetWidth,
			);
			const rest = restRef.current?.offsetWidth ?? 0;
			setFit(countFitting(widths, row.clientWidth - (rest ? rest + GAP : 0)));
		};
		calc();
		const observer = new ResizeObserver(calc);
		observer.observe(row);
		return () => observer.disconnect();
	}, [shownKey, restKey, selected.join()]);

	if (!accountChips && active.length === 0) return null;

	const toggleAccount = (id: string) =>
		onFiltersChange({
			...filters,
			accountIds: selected.includes(id)
				? selected.filter((x) => x !== id)
				: [...selected, id],
		});

	const hidden = shown.length - fit;
	const hiddenSelected = shown
		.slice(fit)
		.some((a) => selected.includes(a.id.toString()));

	return (
		<div ref={rowRef} className="relative mb-6 flex items-center gap-2">
			{accountChips && (
				<>
					{/* invisible copies, so widths are known before deciding what fits */}
					<div
						ref={measureRef}
						aria-hidden
						className="pointer-events-none invisible absolute flex gap-2"
					>
						{shown.map((a) => (
							<AccountChip
								key={a.id.toString()}
								account={a}
								on={selected.includes(a.id.toString())}
							/>
						))}
					</div>
					{shown.slice(0, fit).map((a) => {
						const id = a.id.toString();
						return (
							<AccountChip
								key={id}
								account={a}
								on={selected.includes(id)}
								onClick={() => toggleAccount(id)}
							/>
						);
					})}
					{hidden > 0 && (
						<MultiSelect
							options={options}
							selected={selected}
							onChange={(ids) =>
								onFiltersChange({ ...filters, accountIds: ids })
							}
							placeholder="Search accounts"
						>
							<button
								type="button"
								aria-label={`${hidden} more accounts`}
								className={cn(
									"h-7 shrink-0 rounded-full border px-3 text-sm tabular-nums transition-colors",
									hiddenSelected
										? "border-foreground bg-muted text-foreground"
										: "text-muted-foreground hover:bg-muted hover:text-foreground",
								)}
							>
								+{hidden}
							</button>
						</MultiSelect>
					)}
				</>
			)}

			{(active.length > 0 || hasAnyFilter(filters)) && (
				<div ref={restRef} className="flex shrink-0 items-center gap-2">
					{accountChips && active.length > 0 && (
						<span className="mx-1 h-4 w-px bg-border" />
					)}
					{active.map(([key, label, clear]) => (
						<span
							key={key}
							className="inline-flex h-7 items-center whitespace-nowrap rounded-full bg-muted/70 text-sm"
						>
							<button
								type="button"
								onClick={onOpenPanel}
								className="h-full pr-1 pl-3"
							>
								{label}
							</button>
							<button
								type="button"
								aria-label={`Remove ${key} filter`}
								onClick={() => onFiltersChange({ ...filters, ...clear })}
								className="flex h-full items-center pr-2.5 pl-1 text-muted-foreground hover:text-foreground"
							>
								<X className="size-3.5" />
							</button>
						</span>
					))}
					{hasAnyFilter(filters) && (
						<button
							type="button"
							onClick={() => onFiltersChange({})}
							className="ml-2 text-sm text-muted-foreground hover:text-foreground"
						>
							Clear
						</button>
					)}
				</div>
			)}
		</div>
	);
}
