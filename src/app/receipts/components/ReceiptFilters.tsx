"use client";

import { X } from "lucide-react";
import { Card, VStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReceiptStatus } from "@/gen/nagomi/v1/receipt_pb";
import type { ReceiptFilters } from "@/hooks/useReceipts";

interface ReceiptFiltersPanelProps {
	filters: ReceiptFilters;
	onFiltersChange: (filters: ReceiptFilters) => void;
	isOpen: boolean;
}

const statusOptions: { label: string; value: ReceiptStatus }[] = [
	{ label: "processing", value: ReceiptStatus.PENDING },
	{ label: "parsed", value: ReceiptStatus.PARSED },
	{ label: "linked", value: ReceiptStatus.LINKED },
	{ label: "failed", value: ReceiptStatus.FAILED },
];

function centsToAmount(cents: bigint | undefined): string {
	if (cents === undefined) return "";
	return (Number(cents) / 100).toString();
}

function amountToCents(value: string): bigint | undefined {
	const parsed = parseFloat(value);
	if (Number.isNaN(parsed) || parsed < 0) return undefined;
	return BigInt(Math.round(parsed * 100));
}

export function ReceiptFiltersPanel({
	filters,
	onFiltersChange,
	isOpen,
}: ReceiptFiltersPanelProps) {
	if (!isOpen) return null;

	const updateFilter = <K extends keyof ReceiptFilters>(
		key: K,
		value: ReceiptFilters[K],
	) => {
		onFiltersChange({ ...filters, [key]: value });
	};

	const removeFilter = (key: keyof ReceiptFilters) => {
		const updated = { ...filters };
		delete updated[key];
		onFiltersChange(updated);
	};

	const hasAnyFilters =
		filters.minTotalCents !== undefined ||
		filters.maxTotalCents !== undefined ||
		filters.status !== undefined ||
		filters.unlinkedOnly;

	return (
		<Card className="p-4 mt-2">
			<VStack spacing="md">
				{/* Amount range + currency */}
				<div>
					<Label className="text-xs font-medium mb-2 block">amount range</Label>
					<VStack spacing="xs">
						<Input
							placeholder="currency (e.g. CAD)"
							value={filters.currency ?? ""}
							onChange={(e) =>
								updateFilter(
									"currency",
									e.target.value.toUpperCase() || undefined,
								)
							}
							className="h-8 text-xs font-mono"
							maxLength={3}
						/>
						<Input
							type="number"
							placeholder="min"
							min="0"
							value={centsToAmount(filters.minTotalCents)}
							onChange={(e) =>
								updateFilter("minTotalCents", amountToCents(e.target.value))
							}
							className="h-8 text-xs"
						/>
						<Input
							type="number"
							placeholder="max"
							min="0"
							value={centsToAmount(filters.maxTotalCents)}
							onChange={(e) =>
								updateFilter("maxTotalCents", amountToCents(e.target.value))
							}
							className="h-8 text-xs"
						/>
					</VStack>
					{(filters.minTotalCents !== undefined ||
						filters.maxTotalCents !== undefined ||
						filters.currency) && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								removeFilter("minTotalCents");
								removeFilter("maxTotalCents");
								removeFilter("currency");
							}}
							className="mt-1 h-6 px-2 text-xs"
						>
							<X className="h-3 w-3 mr-1" />
							clear
						</Button>
					)}
				</div>

				{/* Status */}
				<div>
					<Label className="text-xs font-medium mb-2 block">status</Label>
					<div className="flex flex-wrap gap-1.5">
						{statusOptions.map(({ label, value }) => (
							<Button
								key={value}
								variant={filters.status === value ? "default" : "outline"}
								size="sm"
								onClick={() => {
									if (filters.status === value) {
										removeFilter("status");
									} else {
										onFiltersChange({
											...filters,
											status: value,
											unlinkedOnly: undefined,
										});
									}
								}}
								className="h-6 px-2 text-xs"
							>
								{label}
							</Button>
						))}
						<Button
							variant={filters.unlinkedOnly ? "default" : "outline"}
							size="sm"
							onClick={() => {
								if (filters.unlinkedOnly) {
									removeFilter("unlinkedOnly");
								} else {
									onFiltersChange({
										...filters,
										unlinkedOnly: true,
										status: undefined,
									});
								}
							}}
							className="h-6 px-2 text-xs"
						>
							unlinked
						</Button>
					</div>
					{(filters.status !== undefined || filters.unlinkedOnly) && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								removeFilter("status");
								removeFilter("unlinkedOnly");
							}}
							className="mt-1 h-6 px-2 text-xs"
						>
							<X className="h-3 w-3 mr-1" />
							clear
						</Button>
					)}
				</div>

				{hasAnyFilters && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => onFiltersChange({})}
						className="w-full h-8 text-xs"
					>
						clear all filters
					</Button>
				)}
			</VStack>
		</Card>
	);
}
