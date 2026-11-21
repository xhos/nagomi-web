"use client";

import {
	endOfMonth,
	format,
	isSameDay,
	isSameYear,
	startOfMonth,
	subDays,
	subMonths,
} from "date-fns";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { chip, type MultiOption, MultiSelect } from "@/components/ui/forms";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { Account } from "@/gen/nagomi/v1/account_pb";
import { AccountType, TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useUncategorizedCount } from "@/hooks/useTransactionsQuery";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPES } from "@/lib/utils/account";
import {
	getCategoryDisplayName,
	getCategoryLevel,
	searchSlugs,
} from "@/lib/utils/category";

export interface TransactionFilters {
	startDate?: Date;
	endDate?: Date;
	amountMin?: number;
	amountMax?: number;
	direction?: TransactionDirection;
	categories?: string[];
	uncategorized?: boolean;
	accountIds?: string[];
}

// what the Filters button counts: accounts are left out, their chips already show them
export function countActiveFilters(f: TransactionFilters) {
	return [
		f.startDate || f.endDate,
		f.amountMin !== undefined || f.amountMax !== undefined,
		f.direction !== undefined,
		f.categories?.length || f.uncategorized,
	].filter(Boolean).length;
}

export const hasAnyFilter = (f: TransactionFilters) =>
	countActiveFilters(f) > 0 || !!f.accountIds?.length;

function datePresets(today = new Date()): [string, Date, Date][] {
	return [
		["This month", startOfMonth(today), endOfMonth(today)],
		[
			"Last month",
			startOfMonth(subMonths(today, 1)),
			endOfMonth(subMonths(today, 1)),
		],
		["Last 30 days", subDays(today, 30), today],
	];
}

const sameRange = (f: TransactionFilters, a: Date, b: Date) =>
	!!f.startDate &&
	!!f.endDate &&
	isSameDay(f.startDate, a) &&
	isSameDay(f.endDate, b);

const day = (d: Date) =>
	format(d, isSameYear(d, new Date()) ? "MMM d" : "MMM d, yyyy");

export function dateLabel(f: TransactionFilters): string | null {
	if (!f.startDate && !f.endDate) return null;
	const preset = datePresets().find(([, a, b]) => sameRange(f, a, b));
	if (preset) return preset[0];
	if (f.startDate && f.endDate)
		return `${day(f.startDate)} – ${day(f.endDate)}`;
	return f.startDate
		? `From ${day(f.startDate)}`
		: `Until ${day(f.endDate as Date)}`;
}

export function categoryLabel(f: TransactionFilters): string | null {
	const names = [
		...(f.uncategorized ? ["Uncategorized"] : []),
		...(f.categories ?? []).map(getCategoryDisplayName),
	];
	if (names.length === 0) return null;
	if (names.length <= 2) return names.join(", ");
	return `${names[0]} +${names.length - 1}`;
}

export function amountLabel(f: TransactionFilters): string | null {
	const { amountMin: min, amountMax: max } = f;
	if (min !== undefined && max !== undefined) return `${min} – ${max}`;
	if (min !== undefined) return `Over ${min}`;
	if (max !== undefined) return `Under ${max}`;
	return null;
}

export function directionLabel(f: TransactionFilters): string | null {
	if (f.direction === TransactionDirection.DIRECTION_INCOMING)
		return "Money in";
	if (f.direction === TransactionDirection.DIRECTION_OUTGOING)
		return "Money out";
	return null;
}

const typeRank = (t: AccountType) => {
	const i = ACCOUNT_TYPES.findIndex(([type]) => type === t);
	return i < 0 ? ACCOUNT_TYPES.length : i;
};

export const accountName = (a: Account) => a.friendlyName || a.name;

// everyday accounts first, by type then name; friends and closed accounts after
export function sortAccounts(accounts: Account[]) {
	const everyday = (a: Account) =>
		a.type !== AccountType.ACCOUNT_FRIEND && !a.closedAt;
	return [...accounts].sort(
		(a, b) =>
			Number(everyday(b)) - Number(everyday(a)) ||
			typeRank(a.type) - typeRank(b.type) ||
			accountName(a).localeCompare(accountName(b)),
	);
}

// every account as a MultiSelect row, noting the ones that get no quick chip
export const accountOptionsOf = (accounts: Account[]): MultiOption[] =>
	sortAccounts(accounts).map((a) => ({
		value: a.id.toString(),
		label: accountName(a),
		color: a.color || undefined,
		note: a.closedAt
			? "closed"
			: a.type === AccountType.ACCOUNT_FRIEND
				? "friend"
				: undefined,
	}));

export const isQuickAccount = (a: Account) =>
	a.type !== AccountType.ACCOUNT_FRIEND && !a.closedAt;

const fieldLabel = "text-sm text-muted-foreground";
function DateButton({
	value,
	placeholder,
	open,
	onOpenChange,
	onChange,
}: {
	value?: Date;
	placeholder: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onChange: (d?: Date) => void;
}) {
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={cn(
						"w-32 justify-start font-normal",
						!value && "text-muted-foreground",
					)}
				>
					{value ? format(value, "MMM d, yyyy") : placeholder}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar mode="single" selected={value} onSelect={onChange} />
			</PopoverContent>
		</Popover>
	);
}

// the trigger for a MultiSelect: the current choice, or what choosing nothing means
function SelectButton({
	summary,
	empty,
	...props
}: React.ComponentProps<"button"> & { summary: string | null; empty: string }) {
	return (
		<Button
			variant="outline"
			size="sm"
			className="w-56 justify-between font-normal"
			{...props}
		>
			<span className={cn("truncate", !summary && "text-muted-foreground")}>
				{summary ?? empty}
			</span>
			<ChevronDown className="text-muted-foreground" />
		</Button>
	);
}

const UNCATEGORIZED = "\u0000uncategorized";

const searchCategories = (options: MultiOption[], q: string) => {
	const bySlug = new Map(options.map((o) => [o.value, o]));
	return searchSlugs(
		options.map((o) => o.value),
		q,
	).flatMap((s) => bySlug.get(s) ?? []);
};

interface TransactionFiltersPanelProps {
	filters: TransactionFilters;
	onFiltersChange: (filters: TransactionFilters) => void;
}

export function TransactionFiltersPanel({
	filters,
	onFiltersChange,
}: TransactionFiltersPanelProps) {
	const { categories } = useCategories();
	const { accounts } = useAccounts();
	const { data: uncategorizedCount } = useUncategorizedCount();
	const [fromOpen, setFromOpen] = useState(false);
	const [toOpen, setToOpen] = useState(false);
	const set = <K extends keyof TransactionFilters>(
		key: K,
		value: TransactionFilters[K],
	) => onFiltersChange({ ...filters, [key]: value });

	const picked = filters.categories ?? [];
	const categoryOptions = useMemo<MultiOption[]>(() => {
		const colorOf = new Map(categories.map((c) => [c.slug, c.color]));
		const under = (slug: string) =>
			picked.some((p) => slug.startsWith(`${p}.`));
		return [
			{
				value: UNCATEGORIZED,
				label: "Uncategorized",
				pinned: true,
				note:
					uncategorizedCount !== undefined
						? uncategorizedCount.toString()
						: undefined,
			},
			// a parent shows even when only its children are categories ("food" over
			// "food.coffee"), so the tree reads right and the whole branch can be picked
			...[
				...new Set(
					categories.flatMap((c) =>
						c.slug
							.split(".")
							.map((_, i, parts) => parts.slice(0, i + 1).join(".")),
					),
				),
			]
				.sort((a, b) => a.localeCompare(b))
				.map((slug) => ({
					value: slug,
					label: getCategoryDisplayName(slug),
					path: slug.split(".").join(" / "),
					color: colorOf.get(slug),
					depth: getCategoryLevel(slug),
					implied: under(slug),
				})),
		];
	}, [categories, picked, uncategorizedCount]);

	const accountOptions = useMemo(() => accountOptionsOf(accounts), [accounts]);

	const accountSummary = (() => {
		const ids = filters.accountIds ?? [];
		if (ids.length === 0) return null;
		const names = ids.map(
			(id) => accountOptions.find((o) => o.value === id)?.label ?? id,
		);
		return names.length <= 2
			? names.join(", ")
			: `${names[0]} +${names.length - 1}`;
	})();

	const directions: [string, TransactionDirection | undefined][] = [
		["All", undefined],
		["In", TransactionDirection.DIRECTION_INCOMING],
		["Out", TransactionDirection.DIRECTION_OUTGOING],
	];

	return (
		<div className="mb-6 grid gap-x-8 gap-y-3 border-b pb-6 sm:grid-cols-[auto_1fr] sm:items-center">
			<span className={fieldLabel}>Date</span>
			<div className="flex flex-wrap items-center gap-2">
				{datePresets().map(([label, a, b]) => (
					<button
						key={label}
						type="button"
						className={chip(sameRange(filters, a, b), "h-8")}
						onClick={() =>
							sameRange(filters, a, b)
								? onFiltersChange({
										...filters,
										startDate: undefined,
										endDate: undefined,
									})
								: onFiltersChange({ ...filters, startDate: a, endDate: b })
						}
					>
						{label}
					</button>
				))}
				<span className="flex items-center gap-2 sm:ml-2">
					<DateButton
						value={filters.startDate}
						placeholder="From"
						open={fromOpen}
						onOpenChange={setFromOpen}
						onChange={(d) => {
							set("startDate", d);
							if (d) {
								setFromOpen(false);
								setToOpen(true);
							}
						}}
					/>
					<span className="text-muted-foreground">–</span>
					<DateButton
						value={filters.endDate}
						placeholder="To"
						open={toOpen}
						onOpenChange={setToOpen}
						onChange={(d) => {
							set("endDate", d);
							if (d) setToOpen(false);
						}}
					/>
				</span>
			</div>

			<span className={fieldLabel}>Category</span>
			<div>
				<MultiSelect
					options={categoryOptions}
					selected={[
						...(filters.uncategorized ? [UNCATEGORIZED] : []),
						...picked,
					]}
					onChange={(values) =>
						onFiltersChange({
							...filters,
							uncategorized: values.includes(UNCATEGORIZED) || undefined,
							categories: values.filter((v) => v !== UNCATEGORIZED),
						})
					}
					search={searchCategories}
					placeholder="Search categories"
				>
					<SelectButton summary={categoryLabel(filters)} empty="Any category" />
				</MultiSelect>
			</div>

			<span className={fieldLabel}>Account</span>
			<div>
				<MultiSelect
					options={accountOptions}
					selected={filters.accountIds ?? []}
					onChange={(ids) => set("accountIds", ids)}
					placeholder="Search accounts"
				>
					<SelectButton summary={accountSummary} empty="All accounts" />
				</MultiSelect>
			</div>

			<span className={fieldLabel}>Amount</span>
			<div className="flex items-center gap-2">
				<Input
					type="number"
					placeholder="Min"
					className="h-8 w-[6.5rem]"
					value={filters.amountMin ?? ""}
					onChange={(e) =>
						set(
							"amountMin",
							e.target.value ? Number(e.target.value) : undefined,
						)
					}
				/>
				<span className="text-muted-foreground">–</span>
				<Input
					type="number"
					placeholder="Max"
					className="h-8 w-[6.5rem]"
					value={filters.amountMax ?? ""}
					onChange={(e) =>
						set(
							"amountMax",
							e.target.value ? Number(e.target.value) : undefined,
						)
					}
				/>
			</div>

			<span className={fieldLabel}>Direction</span>
			<div className="flex gap-2">
				{directions.map(([label, value]) => (
					<button
						key={label}
						type="button"
						className={chip(filters.direction === value, "h-8")}
						onClick={() => set("direction", value)}
					>
						{label}
					</button>
				))}
			</div>
		</div>
	);
}
