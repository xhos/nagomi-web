"use client";

import { useState } from "react";
import { Card, Muted, Text, VStack } from "@/components/lib";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodType } from "@/gen/nagomi/v1/enums_pb";
import { useCategorySpending } from "@/hooks/useCategorySpending";
import { formatAmount } from "@/lib/utils/transaction";
import { CategorySpendingDonut } from "./category-spending-donut";
import { CategoryTransactionsSheet } from "./category-transactions-sheet";
import { PeriodSelector } from "./period-selector";

interface CategoryBreakdownCardProps {
	userId: string;
}

export function CategoryBreakdownCard({ userId }: CategoryBreakdownCardProps) {
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
			padding="md"
			title="spending breakdown"
			action={
				<PeriodSelector value={periodType} onChange={handlePeriodChange} />
			}
			hideActionUntilHover
		>
			{loading && <Skeleton className="h-[280px]" />}
			{error && (
				<VStack spacing="sm" align="center" justify="center" className="h-64">
					<div className="font-mono text-xs text-muted-foreground">
						failed to load data
					</div>
				</VStack>
			)}
			{!loading && !error && data && (
				<VStack spacing="md" align="center">
					<VStack spacing="xs" align="center">
						<Muted size="xs">total spending</Muted>
						<Text weight="semibold" size="lg">
							${formatAmount(data.totals?.currentPeriodTotal).toFixed(2)}
						</Text>
					</VStack>
					<CategorySpendingDonut
						data={data}
						onCategoryClick={handleCategoryClick}
					/>
				</VStack>
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
