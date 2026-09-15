"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReceiptStatus } from "@/gen/nagomi/v1/receipt_pb";
import type { ReceiptFilters } from "@/hooks/useReceipts";
import { cn } from "@/lib/utils";

export function countActiveReceiptFilters(f: ReceiptFilters) {
	return [
		f.minTotalCents !== undefined ||
			f.maxTotalCents !== undefined ||
			f.currency,
		f.status !== undefined || f.unlinkedOnly,
	].filter(Boolean).length;
}

const STATUSES: [string, ReceiptStatus][] = [
	["Processing", ReceiptStatus.PENDING],
	["Parsed", ReceiptStatus.PARSED],
	["Linked", ReceiptStatus.LINKED],
	["Failed", ReceiptStatus.FAILED],
];

const chip = (on: boolean) =>
	cn(
		"h-7 rounded-md border px-2.5 text-sm transition-colors",
		on ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
	);
const toCents = (v: string) => {
	const n = Number(v);
	return v === "" || !Number.isFinite(n) || n < 0
		? undefined
		: BigInt(Math.round(n * 100));
};
const fromCents = (c?: bigint) =>
	c === undefined ? "" : (Number(c) / 100).toString();

export function ReceiptFiltersPanel({
	filters,
	onFiltersChange,
}: {
	filters: ReceiptFilters;
	onFiltersChange: (f: ReceiptFilters) => void;
}) {
	const set = (patch: Partial<ReceiptFilters>) =>
		onFiltersChange({ ...filters, ...patch });
	return (
		<div className="mb-6 grid gap-x-8 gap-y-3 border-b pb-6 sm:grid-cols-[auto_1fr] sm:items-center">
			<span className="text-sm text-muted-foreground">Status</span>
			<div className="flex flex-wrap gap-2">
				{STATUSES.map(([label, value]) => (
					<button
						key={value}
						type="button"
						className={chip(filters.status === value)}
						onClick={() =>
							set({
								status: filters.status === value ? undefined : value,
								unlinkedOnly: undefined,
							})
						}
					>
						{label}
					</button>
				))}
				<button
					type="button"
					className={chip(!!filters.unlinkedOnly)}
					onClick={() =>
						set({
							unlinkedOnly: filters.unlinkedOnly ? undefined : true,
							status: undefined,
						})
					}
				>
					Not linked
				</button>
			</div>

			<span className="text-sm text-muted-foreground">Total</span>
			<div className="flex flex-wrap items-center gap-2">
				<Input
					type="number"
					placeholder="Min"
					className="h-8 w-32"
					value={fromCents(filters.minTotalCents)}
					onChange={(e) => set({ minTotalCents: toCents(e.target.value) })}
				/>
				<span className="text-muted-foreground">–</span>
				<Input
					type="number"
					placeholder="Max"
					className="h-8 w-32"
					value={fromCents(filters.maxTotalCents)}
					onChange={(e) => set({ maxTotalCents: toCents(e.target.value) })}
				/>
				<Input
					placeholder="Currency"
					className="h-8 w-24"
					maxLength={3}
					value={filters.currency ?? ""}
					onChange={(e) =>
						set({ currency: e.target.value.toUpperCase() || undefined })
					}
				/>
			</div>

			{countActiveReceiptFilters(filters) > 0 && (
				<div className="sm:col-start-2">
					<Button variant="ghost" size="sm" onClick={() => onFiltersChange({})}>
						Clear filters
					</Button>
				</div>
			)}
		</div>
	);
}
