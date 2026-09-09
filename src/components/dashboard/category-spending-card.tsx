"use client";

import { useState } from "react";
import { Card } from "@/components/lib";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodType } from "@/gen/nagomi/v1/enums_pb";
import { useCategorySpending } from "@/hooks/useCategorySpending";
import { formatAmount } from "@/lib/utils/transaction";
import { CategorySpendingChart } from "./category-spending-chart";
import { CategoryTransactionsSheet } from "./category-transactions-sheet";
import { PeriodSelector } from "./period-selector";

interface CategorySpendingCardProps {
	userId: string;
}

export function CategorySpendingCard({ userId }: CategorySpendingCardProps) {
	const [periodType, setPeriodType] = useState<PeriodType>(
		PeriodType.PERIOD_TYPE_90_DAYS,
	);
	const [customDates, setCustomDates] = useState<
		{ start: Date; end: Date } | undefined
	>();
	const [selectedCategory, setSelectedCategory] = useState<{
		slug: string | null;
		name: string;
		color: string;
		startDate?: Date;
		endDate?: Date;
	} | null>(null);

	const handlePeriodChange = (
		period: PeriodType,
		dates?: { start: Date; end: Date },
	) => {
		setPeriodType(period);
		if (period === PeriodType.PERIOD_TYPE_CUSTOM && dates) {
			setCustomDates(dates);
		}
	};

	const handleCategoryClick = (
		slug: string | null,
		name: string,
		color: string,
	) => {
		const dates = getPeriodDates();
		setSelectedCategory({
			slug,
			name,
			color,
			startDate: dates?.start,
			endDate: dates?.end,
		});
	};

	const { data, loading, error } = useCategorySpending(
		userId,
		periodType,
		customDates,
	);

	const getPeriodDates = () => {
		if (!data?.currentPeriod?.startDate || !data?.currentPeriod?.endDate) {
			return undefined;
		}
		const start = new Date(
			data.currentPeriod.startDate.year,
			data.currentPeriod.startDate.month - 1,
			data.currentPeriod.startDate.day,
			0,
			0,
			0,
			0,
		);
		const end = new Date(
			data.currentPeriod.endDate.year,
			data.currentPeriod.endDate.month - 1,
			data.currentPeriod.endDate.day,
			23,
			59,
			59,
			999,
		);
		return { start, end };
	};

	return (
		<Card
			title="spending by category"
			description={
				data?.currentPeriod?.label || "Compare spending across time periods"
			}
			action={
				<PeriodSelector value={periodType} onChange={handlePeriodChange} />
			}
		>
			{loading && <Skeleton className="h-[300px]" />}
			{error && (
				<div className="flex justify-center items-center h-64 text-destructive">
					<div className="text-center">
						<p className="font-semibold">Failed to load data</p>
						<p className="text-sm text-muted-foreground">{error.message}</p>
					</div>
				</div>
			)}
			{!loading && !error && data && (
				<>
					<div className="grid grid-cols-2 gap-3 mb-4">
						<div className="rounded-lg border bg-card p-3">
							<p className="text-xs text-muted-foreground">Current Period</p>
							<p className="text-xl font-bold">
								${formatAmount(data.totals?.currentPeriodTotal).toFixed(2)}
							</p>
						</div>
						<div className="rounded-lg border bg-card p-3">
							<p className="text-xs text-muted-foreground">Previous Period</p>
							<p className="text-xl font-bold">
								${formatAmount(data.totals?.previousPeriodTotal).toFixed(2)}
							</p>
						</div>
					</div>

					<CategorySpendingChart
						data={data}
						onCategoryClick={handleCategoryClick}
					/>
				</>
			)}
			<CategoryTransactionsSheet
				open={!!selectedCategory}
				onOpenChange={(open) => !open && setSelectedCategory(null)}
				userId={userId}
				categorySlug={selectedCategory?.slug || null}
				categoryName={selectedCategory?.name || ""}
				categoryColor={selectedCategory?.color || ""}
				startDate={selectedCategory?.startDate}
				endDate={selectedCategory?.endDate}
			/>
		</Card>
	);
}
