"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { ChartConfig } from "@/components/ui/chart";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import type { GetCategorySpendingComparisonResponse } from "@/gen/nagomi/v1/dashboard_services_pb";
import { getCategoryDisplayName } from "@/lib/utils/category";
import { formatAmount } from "@/lib/utils/transaction";

interface CategorySpendingChartProps {
	data: GetCategorySpendingComparisonResponse;
	onCategoryClick?: (
		categorySlug: string | null,
		categoryName: string,
		categoryColor: string,
	) => void;
}

interface ChartDataItem {
	category: string;
	categorySlug: string;
	categoryColor: string;
	currentAmount: number;
	previousAmount: number;
	currentCount: number;
	previousCount: number;
}

export function CategorySpendingChart({
	data,
	onCategoryClick,
}: CategorySpendingChartProps) {
	const chartData: ChartDataItem[] = [
		...data.categories.map((item) => ({
			category: item.category?.slug
				? getCategoryDisplayName(item.category.slug)
				: "Unknown",
			categorySlug: item.category?.slug || "unknown",
			categoryColor: item.category?.color || "#666666",
			currentAmount: formatAmount(item.spending?.currentPeriod?.amount),
			previousAmount: formatAmount(item.spending?.previousPeriod?.amount),
			currentCount: Number(
				item.spending?.currentPeriod?.transactionCount || BigInt(0),
			),
			previousCount: Number(
				item.spending?.previousPeriod?.transactionCount || BigInt(0),
			),
		})),
		...(data.uncategorized
			? [
					{
						category: "Uncategorized",
						categorySlug: "uncategorized",
						categoryColor: "#999999",
						currentAmount: formatAmount(
							data.uncategorized.currentPeriod?.amount,
						),
						previousAmount: formatAmount(
							data.uncategorized.previousPeriod?.amount,
						),
						currentCount: Number(
							data.uncategorized.currentPeriod?.transactionCount || BigInt(0),
						),
						previousCount: Number(
							data.uncategorized.previousPeriod?.transactionCount || BigInt(0),
						),
					},
				]
			: []),
	];

	const chartConfig = {
		currentAmount: {
			label: "Current Period",
		},
		previousAmount: {
			label: "Previous Period",
		},
	} satisfies ChartConfig;

	if (chartData.length === 0) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="font-mono text-xs text-muted-foreground">
					no spending data for this period
				</div>
			</div>
		);
	}

	return (
		<ChartContainer config={chartConfig} className="h-[300px] w-full">
			<BarChart
				accessibilityLayer
				data={chartData}
				margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
			>
				<CartesianGrid strokeDasharray="3 3" vertical={false} />
				<XAxis
					dataKey="category"
					tickLine={false}
					tickMargin={8}
					axisLine={false}
					angle={-45}
					textAnchor="end"
					height={80}
					fontSize={12}
				/>
				<YAxis
					tickLine={false}
					axisLine={false}
					tickFormatter={(value) => `$${value.toFixed(0)}`}
				/>
				<ChartTooltip
					content={
						<ChartTooltipContent
							labelFormatter={(_, payload) => {
								if (payload?.[0]) {
									const data = payload[0].payload as ChartDataItem;
									return (
										<div>
											<div className="font-semibold">{data.category}</div>
											<div className="text-xs text-muted-foreground">
												{data.categorySlug}
											</div>
										</div>
									);
								}
								return "";
							}}
							formatter={(value, name, item) => {
								const data = item.payload as ChartDataItem;
								const amount = value as number;
								const count =
									name === "currentAmount"
										? data.currentCount
										: data.previousCount;
								const change = data.currentAmount - data.previousAmount;
								const changePercent =
									data.previousAmount !== 0
										? ((change / data.previousAmount) * 100).toFixed(1)
										: "N/A";

								return (
									<div className="flex flex-col gap-1">
										<div className="flex justify-between gap-4">
											<span className="font-medium">${amount.toFixed(2)}</span>
											<span className="text-xs text-muted-foreground">
												{count} {count === 1 ? "txn" : "txns"}
											</span>
										</div>
										{name === "currentAmount" && (
											<div
												className={`text-xs ${
													change > 0
														? "text-red-600"
														: change < 0
															? "text-green-600"
															: "text-muted-foreground"
												}`}
											>
												{change > 0 ? "+" : ""}${change.toFixed(2)} (
												{changePercent}%)
											</div>
										)}
									</div>
								);
							}}
						/>
					}
				/>
				<Bar
					dataKey="previousAmount"
					fill="#9ca3af"
					radius={[4, 4, 0, 0]}
					opacity={0.3}
					name="Previous Period"
				/>
				<Bar
					dataKey="currentAmount"
					radius={[4, 4, 0, 0]}
					name="Current Period"
					onClick={(data) => {
						if (onCategoryClick && data) {
							const item = data as unknown as ChartDataItem;
							onCategoryClick(
								item.categorySlug === "uncategorized"
									? null
									: item.categorySlug,
								item.category,
								item.categoryColor,
							);
						}
					}}
					style={{ cursor: onCategoryClick ? "pointer" : "default" }}
				>
					{chartData.map((entry, index) => (
						<Bar
							key={`bar-${index}`}
							dataKey="currentAmount"
							fill={entry.categoryColor}
						/>
					))}
				</Bar>
			</BarChart>
		</ChartContainer>
	);
}
