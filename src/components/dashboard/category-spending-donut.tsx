"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, Sector } from "recharts";
import type { ChartConfig } from "@/components/ui/chart";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import type { GetCategorySpendingComparisonResponse } from "@/gen/nagomi/v1/dashboard_services_pb";
import { getCategoryDisplayName } from "@/lib/utils/category";
import { formatAmount } from "@/lib/utils/transaction";

interface CategorySpendingDonutProps {
	data: GetCategorySpendingComparisonResponse;
	onCategoryClick?: (
		categorySlug: string | null,
		categoryName: string,
		categoryColor: string,
	) => void;
}

interface DonutDataItem {
	name: string;
	value: number;
	fill: string;
	percentage: number;
	slug: string | null;
}

const renderActiveShape = (props: unknown) => {
	const recordData = props as Record<string, unknown>;
	const RADIAN = Math.PI / 180;
	const {
		cx = 0,
		cy = 0,
		midAngle = 0,
		innerRadius = 0,
		outerRadius = 0,
		startAngle = 0,
		endAngle = 0,
		fill = "#000000",
		payload = {},
		percent = 0,
		value = 0,
	} = recordData as {
		cx?: number;
		cy?: number;
		midAngle?: number;
		innerRadius?: number;
		outerRadius?: number;
		startAngle?: number;
		endAngle?: number;
		fill?: string;
		payload?: Record<string, unknown>;
		percent?: number;
		value?: number;
	};
	const sin = Math.sin(-RADIAN * midAngle);
	const cos = Math.cos(-RADIAN * midAngle);
	const sx = cx + (outerRadius + 10) * cos;
	const sy = cy + (outerRadius + 10) * sin;
	const mx = cx + (outerRadius + 30) * cos;
	const my = cy + (outerRadius + 30) * sin;
	const ex = mx + (cos >= 0 ? 1 : -1) * 22;
	const ey = my;
	const textAnchor = cos >= 0 ? "start" : "end";

	return (
		<g>
			<text
				x={cx}
				y={cy}
				dy={8}
				textAnchor="middle"
				className="fill-foreground text-sm font-semibold"
			>
				{String((payload as Record<string, unknown>)?.name || "Category")}
			</text>
			<Sector
				cx={cx}
				cy={cy}
				innerRadius={innerRadius}
				outerRadius={outerRadius}
				startAngle={startAngle}
				endAngle={endAngle}
				fill={fill}
			/>
			<Sector
				cx={cx}
				cy={cy}
				startAngle={startAngle}
				endAngle={endAngle}
				innerRadius={outerRadius + 6}
				outerRadius={outerRadius + 10}
				fill={fill}
			/>
			<path
				d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
				stroke={fill}
				fill="none"
			/>
			<circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
			<text
				x={ex + (cos >= 0 ? 1 : -1) * 12}
				y={ey}
				textAnchor={textAnchor}
				className="fill-foreground text-xs font-medium"
			>{`$${value.toFixed(2)}`}</text>
			<text
				x={ex + (cos >= 0 ? 1 : -1) * 12}
				y={ey}
				dy={18}
				textAnchor={textAnchor}
				className="fill-muted-foreground text-xs"
			>
				{`${(percent * 100).toFixed(1)}%`}
			</text>
		</g>
	);
};

export function CategorySpendingDonut({
	data,
	onCategoryClick,
}: CategorySpendingDonutProps) {
	const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

	const donutData: DonutDataItem[] = [
		...data.categories.map((item) => {
			const amount = formatAmount(item.spending?.currentPeriod?.amount);
			return {
				name: item.category?.slug
					? getCategoryDisplayName(item.category.slug)
					: "Unknown",
				value: amount,
				fill: item.category?.color || "#666666",
				percentage: 0, // Will be calculated below
				slug: item.category?.slug || null,
			};
		}),
		...(data.uncategorized
			? [
					{
						name: "Uncategorized",
						value: formatAmount(data.uncategorized.currentPeriod?.amount),
						fill: "#999999",
						percentage: 0,
						slug: null,
					},
				]
			: []),
	].filter((item) => item.value > 0);

	const total = donutData.reduce((sum, item) => sum + item.value, 0);

	donutData.forEach((item) => {
		item.percentage = (item.value / total) * 100;
	});

	const chartConfig = Object.fromEntries(
		donutData.map((item) => [
			item.name,
			{ label: item.name, color: item.fill },
		]),
	) satisfies ChartConfig;

	if (donutData.length === 0) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="font-mono text-xs text-muted-foreground">
					no spending data for this period
				</div>
			</div>
		);
	}

	return (
		<ChartContainer config={chartConfig} className="h-[280px] w-full">
			<PieChart>
				<ChartTooltip
					content={
						<ChartTooltipContent
							hideLabel
							formatter={(value) => (
								<div className="flex items-center gap-2">
									<span className="font-medium">
										${(value as number).toFixed(2)}
									</span>
									<span className="text-xs text-muted-foreground">
										({(((value as number) / total) * 100).toFixed(1)}%)
									</span>
								</div>
							)}
						/>
					}
				/>
				<Pie
					data={donutData}
					cx="50%"
					cy="50%"
					innerRadius={60}
					outerRadius={90}
					dataKey="value"
					activeIndex={activeIndex}
					activeShape={renderActiveShape}
					onMouseEnter={(_, index) => setActiveIndex(index)}
					onMouseLeave={() => setActiveIndex(undefined)}
					onClick={(data) => {
						if (
							onCategoryClick &&
							data &&
							typeof data === "object" &&
							"name" in data
						) {
							const entry = data as DonutDataItem;
							onCategoryClick(entry.slug, entry.name, entry.fill);
						}
					}}
					style={{ cursor: onCategoryClick ? "pointer" : "default" }}
				>
					{donutData.map((entry, index) => (
						<Cell key={`cell-${index}`} fill={entry.fill} />
					))}
				</Pie>
			</PieChart>
		</ChartContainer>
	);
}
