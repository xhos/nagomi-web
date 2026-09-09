"use client";

import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Card, VStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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

interface TransactionFiltersPanelProps {
	filters: TransactionFilters;
	onFiltersChange: (filters: TransactionFilters) => void;
	isOpen: boolean;
}

export function TransactionFiltersPanel({
	filters,
	onFiltersChange,
	isOpen,
}: TransactionFiltersPanelProps) {
	const { categories } = useCategories();

	if (!isOpen) return null;

	const updateFilter = <K extends keyof TransactionFilters>(
		key: K,
		value: TransactionFilters[K],
	) => {
		onFiltersChange({ ...filters, [key]: value });
	};

	const removeFilter = (key: keyof TransactionFilters) => {
		const newFilters = { ...filters };
		delete newFilters[key];
		onFiltersChange(newFilters);
	};

	const handleClearAll = () => {
		onFiltersChange({});
	};

	const toggleCategory = (categorySlug: string) => {
		const currentSlugs = filters.categories || [];
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

	const hasAnyFilters =
		filters.startDate ||
		filters.endDate ||
		filters.amountMin !== undefined ||
		filters.amountMax !== undefined ||
		filters.direction !== undefined ||
		(filters.categories && filters.categories.length > 0);

	return (
		<Card className="p-4">
			<VStack spacing="md">
				{/* Date Range */}
				<div>
					<Label className="text-xs font-medium mb-2 block">date range</Label>
					<VStack spacing="xs">
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className={cn(
										"w-full justify-start text-left font-normal h-8 text-xs",
										!filters.startDate && "text-muted-foreground",
									)}
								>
									<CalendarIcon className="mr-2 h-3 w-3" />
									{filters.startDate
										? format(filters.startDate, "PPP")
										: "start date"}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="single"
									selected={filters.startDate}
									onSelect={(date) => updateFilter("startDate", date)}
									initialFocus
								/>
							</PopoverContent>
						</Popover>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className={cn(
										"w-full justify-start text-left font-normal h-8 text-xs",
										!filters.endDate && "text-muted-foreground",
									)}
								>
									<CalendarIcon className="mr-2 h-3 w-3" />
									{filters.endDate
										? format(filters.endDate, "PPP")
										: "end date"}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="single"
									selected={filters.endDate}
									onSelect={(date) => updateFilter("endDate", date)}
									initialFocus
								/>
							</PopoverContent>
						</Popover>
					</VStack>
					{(filters.startDate || filters.endDate) && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								removeFilter("startDate");
								removeFilter("endDate");
							}}
							className="mt-1 h-6 px-2 text-xs"
						>
							<X className="h-3 w-3 mr-1" />
							clear
						</Button>
					)}
				</div>

				{/* Amount Range */}
				<div>
					<Label className="text-xs font-medium mb-2 block">amount range</Label>
					<VStack spacing="xs">
						<Input
							type="number"
							placeholder="min"
							value={filters.amountMin ?? ""}
							onChange={(e) =>
								updateFilter(
									"amountMin",
									e.target.value ? parseFloat(e.target.value) : undefined,
								)
							}
							className="h-8 text-xs"
						/>
						<Input
							type="number"
							placeholder="max"
							value={filters.amountMax ?? ""}
							onChange={(e) =>
								updateFilter(
									"amountMax",
									e.target.value ? parseFloat(e.target.value) : undefined,
								)
							}
							className="h-8 text-xs"
						/>
					</VStack>
					{(filters.amountMin !== undefined ||
						filters.amountMax !== undefined) && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								removeFilter("amountMin");
								removeFilter("amountMax");
							}}
							className="mt-1 h-6 px-2 text-xs"
						>
							<X className="h-3 w-3 mr-1" />
							clear
						</Button>
					)}
				</div>

				{/* Direction */}
				<div>
					<Label className="text-xs font-medium mb-2 block">direction</Label>
					<VStack spacing="xs">
						<Button
							variant={filters.direction === undefined ? "default" : "outline"}
							size="sm"
							onClick={() => removeFilter("direction")}
							className="w-full h-7 text-xs"
						>
							all
						</Button>
						<Button
							variant={
								filters.direction === TransactionDirection.DIRECTION_INCOMING
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
							className="w-full h-7 text-xs"
						>
							incoming
						</Button>
						<Button
							variant={
								filters.direction === TransactionDirection.DIRECTION_OUTGOING
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
							className="w-full h-7 text-xs"
						>
							outgoing
						</Button>
					</VStack>
				</div>

				{/* Categories */}
				{categories.length > 0 && (
					<div>
						<Label className="text-xs font-medium mb-2 block">categories</Label>
						<div className="flex flex-wrap gap-1.5">
							{categories.map((category) => {
								const isSelected = filters.categories?.includes(category.slug);
								return (
									<Button
										key={category.id.toString()}
										variant={isSelected ? "default" : "outline"}
										size="sm"
										onClick={() => toggleCategory(category.slug)}
										className="h-6 px-2 text-xs"
									>
										{category.slug}
									</Button>
								);
							})}
						</div>
						{filters.categories && filters.categories.length > 0 && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => removeFilter("categories")}
								className="mt-1 h-6 px-2 text-xs"
							>
								<X className="h-3 w-3 mr-1" />
								clear ({filters.categories.length})
							</Button>
						)}
					</div>
				)}

				{/* Clear All */}
				{hasAnyFilters && (
					<Button
						variant="outline"
						size="sm"
						onClick={handleClearAll}
						className="w-full h-8 text-xs"
					>
						clear all filters
					</Button>
				)}
			</VStack>
		</Card>
	);
}
