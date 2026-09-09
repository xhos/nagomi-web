"use client";

import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { useState } from "react";
import { HStack, VStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import { useCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/utils";

export interface TransactionFilters {
	startDate?: Date;
	endDate?: Date;
	amountMin?: number;
	amountMax?: number;
	direction?: TransactionDirection;
	categories?: string[];
}

interface TransactionFiltersDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	filters: TransactionFilters;
	onFiltersChange: (filters: TransactionFilters) => void;
}

export function TransactionFiltersDialog({
	open,
	onOpenChange,
	filters,
	onFiltersChange,
}: TransactionFiltersDialogProps) {
	const [localFilters, setLocalFilters] = useState<TransactionFilters>(filters);
	const { categories } = useCategories();

	const handleApply = () => {
		onFiltersChange(localFilters);
		onOpenChange(false);
	};

	const handleClear = () => {
		const clearedFilters: TransactionFilters = {};
		setLocalFilters(clearedFilters);
		onFiltersChange(clearedFilters);
	};

	const updateFilter = <K extends keyof TransactionFilters>(
		key: K,
		value: TransactionFilters[K],
	) => {
		setLocalFilters((prev) => ({ ...prev, [key]: value }));
	};

	const removeFilter = (key: keyof TransactionFilters) => {
		setLocalFilters((prev) => {
			const newFilters = { ...prev };
			delete newFilters[key];
			return newFilters;
		});
	};

	const toggleCategory = (categorySlug: string) => {
		const currentSlugs = localFilters.categories || [];
		const exists = currentSlugs.includes(categorySlug);

		if (exists) {
			updateFilter(
				"categories",
				currentSlugs.filter((slug) => slug !== categorySlug),
			);
		} else {
			updateFilter("categories", [...currentSlugs, categorySlug]);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>filters</DialogTitle>
				</DialogHeader>

				<VStack spacing="lg" className="py-4">
					{/* Date Range */}
					<div>
						<Label className="text-sm font-medium mb-2 block">date range</Label>
						<HStack spacing="sm">
							<div className="flex-1">
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											size="sm"
											className={cn(
												"w-full justify-start text-left font-normal",
												!localFilters.startDate && "text-muted-foreground",
											)}
										>
											<CalendarIcon className="mr-2 h-4 w-4" />
											{localFilters.startDate
												? format(localFilters.startDate, "PPP")
												: "start date"}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0" align="start">
										<Calendar
											mode="single"
											selected={localFilters.startDate}
											onSelect={(date) => updateFilter("startDate", date)}
											initialFocus
										/>
									</PopoverContent>
								</Popover>
							</div>
							<div className="flex-1">
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											size="sm"
											className={cn(
												"w-full justify-start text-left font-normal",
												!localFilters.endDate && "text-muted-foreground",
											)}
										>
											<CalendarIcon className="mr-2 h-4 w-4" />
											{localFilters.endDate
												? format(localFilters.endDate, "PPP")
												: "end date"}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0" align="start">
										<Calendar
											mode="single"
											selected={localFilters.endDate}
											onSelect={(date) => updateFilter("endDate", date)}
											initialFocus
										/>
									</PopoverContent>
								</Popover>
							</div>
						</HStack>
						{(localFilters.startDate || localFilters.endDate) && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									removeFilter("startDate");
									removeFilter("endDate");
								}}
								className="mt-2 h-6 px-2 text-xs"
							>
								<X className="h-3 w-3 mr-1" />
								clear dates
							</Button>
						)}
					</div>

					{/* Amount Range */}
					<div>
						<Label className="text-sm font-medium mb-2 block">
							amount range
						</Label>
						<HStack spacing="sm">
							<div className="flex-1">
								<Input
									type="number"
									placeholder="min"
									value={localFilters.amountMin ?? ""}
									onChange={(e) =>
										updateFilter(
											"amountMin",
											e.target.value ? parseFloat(e.target.value) : undefined,
										)
									}
									className="h-9"
								/>
							</div>
							<div className="flex-1">
								<Input
									type="number"
									placeholder="max"
									value={localFilters.amountMax ?? ""}
									onChange={(e) =>
										updateFilter(
											"amountMax",
											e.target.value ? parseFloat(e.target.value) : undefined,
										)
									}
									className="h-9"
								/>
							</div>
						</HStack>
						{(localFilters.amountMin !== undefined ||
							localFilters.amountMax !== undefined) && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									removeFilter("amountMin");
									removeFilter("amountMax");
								}}
								className="mt-2 h-6 px-2 text-xs"
							>
								<X className="h-3 w-3 mr-1" />
								clear amount
							</Button>
						)}
					</div>

					{/* Direction */}
					<div>
						<Label className="text-sm font-medium mb-2 block">direction</Label>
						<HStack spacing="xs">
							<Button
								variant={
									localFilters.direction === undefined ? "default" : "outline"
								}
								size="sm"
								onClick={() => removeFilter("direction")}
								className="flex-1"
							>
								all
							</Button>
							<Button
								variant={
									localFilters.direction ===
									TransactionDirection.DIRECTION_INCOMING
										? "default"
										: "outline"
								}
								size="sm"
								onClick={() =>
									updateFilter(
										"direction",
										TransactionDirection.DIRECTION_INCOMING,
									)
								}
								className="flex-1"
							>
								incoming
							</Button>
							<Button
								variant={
									localFilters.direction ===
									TransactionDirection.DIRECTION_OUTGOING
										? "default"
										: "outline"
								}
								size="sm"
								onClick={() =>
									updateFilter(
										"direction",
										TransactionDirection.DIRECTION_OUTGOING,
									)
								}
								className="flex-1"
							>
								outgoing
							</Button>
						</HStack>
					</div>

					{/* Categories */}
					{categories.length > 0 && (
						<div>
							<Label className="text-sm font-medium mb-2 block">
								categories
							</Label>
							<div className="flex flex-wrap gap-2">
								{categories.map((category) => {
									const isSelected = localFilters.categories?.includes(
										category.slug,
									);
									return (
										<Button
											key={category.id.toString()}
											variant={isSelected ? "default" : "outline"}
											size="sm"
											onClick={() => toggleCategory(category.slug)}
											className="h-7 px-3 text-xs"
										>
											{category.slug}
										</Button>
									);
								})}
							</div>
							{localFilters.categories &&
								localFilters.categories.length > 0 && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => removeFilter("categories")}
										className="mt-2 h-6 px-2 text-xs"
									>
										<X className="h-3 w-3 mr-1" />
										clear categories ({localFilters.categories.length})
									</Button>
								)}
						</div>
					)}
				</VStack>

				<DialogFooter>
					<Button variant="outline" onClick={handleClear} size="sm">
						clear all
					</Button>
					<Button onClick={handleApply} size="sm">
						apply filters
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
