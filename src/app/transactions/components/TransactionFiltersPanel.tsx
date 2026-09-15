"use client";

import {
	endOfMonth,
	format,
	isSameDay,
	startOfMonth,
	subDays,
	subMonths,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import { useCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/utils";
import { getCategoryDisplayName } from "@/lib/utils/category";

export interface TransactionFilters {
	startDate?: Date;
	endDate?: Date;
	amountMin?: number;
	amountMax?: number;
	direction?: TransactionDirection;
	categories?: string[];
	uncategorized?: boolean;
}

export function countActiveFilters(f: TransactionFilters) {
	return [
		f.startDate || f.endDate,
		f.amountMin !== undefined || f.amountMax !== undefined,
		f.direction !== undefined,
		f.categories?.length,
		f.uncategorized,
	].filter(Boolean).length;
}

interface TransactionFiltersPanelProps {
	filters: TransactionFilters;
	onFiltersChange: (filters: TransactionFilters) => void;
}

const fieldLabel = "text-sm text-muted-foreground";
const chip = (on: boolean) =>
	cn(
		"h-7 rounded-md border px-2.5 text-sm transition-colors",
		on
			? "border-foreground bg-foreground text-background"
			: "border-border hover:bg-muted",
	);

function DateButton({
	value,
	placeholder,
	onChange,
}: {
	value?: Date;
	placeholder: string;
	onChange: (d?: Date) => void;
}) {
	return (
		<Popover>
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

export function TransactionFiltersPanel({
	filters,
	onFiltersChange,
}: TransactionFiltersPanelProps) {
	const { categories } = useCategories();
	const set = <K extends keyof TransactionFilters>(
		key: K,
		value: TransactionFilters[K],
	) => onFiltersChange({ ...filters, [key]: value });

	const toggleCategory = (slug: string) => {
		const cur = filters.categories ?? [];
		set(
			"categories",
			cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug],
		);
	};

	const today = new Date();
	const presets: [string, Date, Date][] = [
		["This month", startOfMonth(today), endOfMonth(today)],
		[
			"Last month",
			startOfMonth(subMonths(today, 1)),
			endOfMonth(subMonths(today, 1)),
		],
		["Last 30 days", subDays(today, 30), today],
	];
	const presetActive = (a: Date, b: Date) =>
		!!filters.startDate &&
		!!filters.endDate &&
		isSameDay(filters.startDate, a) &&
		isSameDay(filters.endDate, b);

	const directions: [string, TransactionDirection | undefined][] = [
		["All", undefined],
		["In", TransactionDirection.DIRECTION_INCOMING],
		["Out", TransactionDirection.DIRECTION_OUTGOING],
	];

	return (
		<div className="mb-6 grid gap-x-8 gap-y-3 border-b pb-6 sm:grid-cols-[auto_1fr] sm:items-center">
			<span className={fieldLabel}>Date</span>
			<div className="flex flex-wrap items-center gap-2">
				{presets.map(([label, a, b]) => (
					<button
						key={label}
						type="button"
						className={chip(presetActive(a, b))}
						onClick={() =>
							onFiltersChange({ ...filters, startDate: a, endDate: b })
						}
					>
						{label}
					</button>
				))}
				<span className="w-2" />
				<DateButton
					value={filters.startDate}
					placeholder="From"
					onChange={(d) => set("startDate", d)}
				/>
				<span className="text-muted-foreground">–</span>
				<DateButton
					value={filters.endDate}
					placeholder="To"
					onChange={(d) => set("endDate", d)}
				/>
			</div>

			<span className={fieldLabel}>Amount</span>
			<div className="flex items-center gap-2">
				<Input
					type="number"
					placeholder="Min"
					className="h-8 w-32"
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
					className="h-8 w-32"
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
						className={chip(filters.direction === value)}
						onClick={() => set("direction", value)}
					>
						{label}
					</button>
				))}
			</div>

			{categories.length > 0 && (
				<>
					<span className={cn(fieldLabel, "sm:self-start sm:pt-1")}>
						Category
					</span>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							className={chip(!!filters.uncategorized)}
							onClick={() =>
								set("uncategorized", filters.uncategorized ? undefined : true)
							}
						>
							Uncategorized
						</button>
						{categories.map((c) => (
							<button
								key={c.id.toString()}
								type="button"
								className={chip(!!filters.categories?.includes(c.slug))}
								onClick={() => toggleCategory(c.slug)}
							>
								{getCategoryDisplayName(c.slug)}
							</button>
						))}
					</div>
				</>
			)}

			{countActiveFilters(filters) > 0 && (
				<div className="sm:col-start-2">
					<Button variant="ghost" size="sm" onClick={() => onFiltersChange({})}>
						Clear filters
					</Button>
				</div>
			)}
		</div>
	);
}
