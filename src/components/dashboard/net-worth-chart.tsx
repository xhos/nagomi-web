"use client";

import { create } from "@bufbuild/protobuf";
import { useQuery } from "@tanstack/react-query";
import { subDays, subMonths, subWeeks } from "date-fns";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card } from "@/components/lib";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { DateSchema } from "@/gen/google/type/date_pb";
import { Granularity, PeriodType } from "@/gen/nagomi/v1/enums_pb";
import { dashboardApi } from "@/lib/api/dashboard";
import { formatAmount } from "@/lib/utils/transaction";
import { PeriodSelector } from "./period-selector";

interface NetWorthChartProps {
	userId: string;
}

const chartConfig = {
	netWorth: {
		label: "Net Worth",
		color: "var(--color-accent-primary)",
	},
} satisfies ChartConfig;

export function NetWorthChart({ userId }: NetWorthChartProps) {
	const [periodType, setPeriodType] = useState<PeriodType>(
		PeriodType.PERIOD_TYPE_90_DAYS,
	);
	const [customDates, setCustomDates] = useState<
		{ start: Date; end: Date } | undefined
	>();

	const handlePeriodChange = (
		period: PeriodType,
		dates?: { start: Date; end: Date },
	) => {
		setPeriodType(period);
		if (period === PeriodType.PERIOD_TYPE_CUSTOM && dates) {
			setCustomDates(dates);
		}
	};

	// Determine appropriate granularity based on date range in days
	const getGranularity = (daysBack: number) => {
		if (daysBack < 60) {
			return Granularity.DAY;
		} else if (daysBack < 365) {
			return Granularity.WEEK;
		} else {
			return Granularity.MONTH;
		}
	};

	// Calculate date range based on period type, aligned with granularity
	const getDateRange = () => {
		const endDate = new Date();
		let startDate: Date;
		let daysBack: number;

		if (periodType === PeriodType.PERIOD_TYPE_CUSTOM && customDates) {
			return {
				startDate: customDates.start,
				endDate: customDates.end,
				granularity: getGranularity(
					Math.ceil(
						(customDates.end.getTime() - customDates.start.getTime()) /
							(1000 * 60 * 60 * 24),
					),
				),
			};
		}

		switch (periodType) {
			case PeriodType.PERIOD_TYPE_7_DAYS:
				daysBack = 7;
				break;
			case PeriodType.PERIOD_TYPE_30_DAYS:
				daysBack = 30;
				break;
			case PeriodType.PERIOD_TYPE_90_DAYS:
				daysBack = 90;
				break;
			case PeriodType.PERIOD_TYPE_3_MONTHS:
				daysBack = 90;
				break;
			case PeriodType.PERIOD_TYPE_6_MONTHS:
				daysBack = 180;
				break;
			case PeriodType.PERIOD_TYPE_1_YEAR:
				daysBack = 365;
				break;
			case PeriodType.PERIOD_TYPE_ALL_TIME:
				daysBack = 730; // 2 years back as a reasonable maximum
				break;
			default:
				daysBack = 365;
		}

		const granularity = getGranularity(daysBack);

		// Adjust start date to align with granularity, ensuring endDate is always a data point
		if (granularity === Granularity.WEEK) {
			const weeksBack = Math.ceil(daysBack / 7);
			startDate = subWeeks(endDate, weeksBack);
		} else if (granularity === Granularity.MONTH) {
			const monthsBack = Math.ceil(daysBack / 30);
			startDate = subMonths(endDate, monthsBack);
		} else {
			startDate = subDays(endDate, daysBack);
		}

		return { startDate, endDate, granularity };
	};

	const { startDate, endDate, granularity } = getDateRange();

	const { data, isLoading, error } = useQuery({
		queryKey: ["net-worth-history", userId, periodType, customDates],
		queryFn: () =>
			dashboardApi.getNetWorthHistory({
				userId,
				startDate: create(DateSchema, {
					year: startDate.getFullYear(),
					month: startDate.getMonth() + 1,
					day: startDate.getDate(),
				}),
				endDate: create(DateSchema, {
					year: endDate.getFullYear(),
					month: endDate.getMonth() + 1,
					day: endDate.getDate(),
				}),
				granularity,
			}),
	});

	if (isLoading) {
		return (
			<Card padding="md" title="net worth over time" description="Loading...">
				<Skeleton className="h-[300px] w-full" />
			</Card>
		);
	}

	if (error || !data || data.dataPoints.length === 0) {
		return (
			<Card padding="md" title="net worth over time">
				<div className="flex h-[300px] items-center justify-center">
					<div className="font-mono text-xs text-muted-foreground">
						{error
							? "failed to load net worth data"
							: "no net worth history found"}
					</div>
				</div>
			</Card>
		);
	}

	const chartData = data.dataPoints.map((point) => ({
		date: `${point.date?.year}-${String(point.date?.month).padStart(2, "0")}-${String(point.date?.day).padStart(2, "0")}`,
		netWorth: formatAmount(point.netWorth),
	}));

	const currentValue = chartData[chartData.length - 1]?.netWorth ?? 0;
	const previousValue = chartData[chartData.length - 2]?.netWorth ?? 0;
	const change = currentValue - previousValue;
	const changePercent =
		previousValue !== 0 ? ((change / previousValue) * 100).toFixed(1) : "0.0";

	const getChangeLabel = () => {
		if (granularity === Granularity.DAY) {
			return "from previous day";
		} else if (granularity === Granularity.WEEK) {
			return "from previous week";
		}
		return "from previous month";
	};

	return (
		<Card
			padding="md"
			title="net worth over time"
			description={
				<>
					<span className="tabular-nums">
						$
						{currentValue.toLocaleString("en-US", {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2,
						})}
					</span>
					<span
						className={`ml-2 text-xs ${change > 0 ? "text-green-600 dark:text-green-400" : change < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
					>
						{change > 0 ? "↑" : change < 0 ? "↓" : ""}{" "}
						{change !== 0
							? `${change > 0 ? "+" : ""}${changePercent}%`
							: "no change"}{" "}
						{getChangeLabel()}
					</span>
				</>
			}
			action={
				<PeriodSelector value={periodType} onChange={handlePeriodChange} />
			}
			hideActionUntilHover
		>
			<ChartContainer config={chartConfig} className="min-h-[300px] w-full">
				<AreaChart
					accessibilityLayer
					data={chartData}
					margin={{
						left: 12,
						right: 12,
						top: 12,
					}}
				>
					<CartesianGrid vertical={false} />
					<XAxis
						dataKey="date"
						tickLine={false}
						axisLine={false}
						tickMargin={8}
						tickFormatter={(value) => {
							const date = new Date(value);
							if (granularity === Granularity.DAY) {
								return date.toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
								});
							} else if (granularity === Granularity.WEEK) {
								return date.toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
								});
							}
							return date.toLocaleDateString("en-US", { month: "short" });
						}}
					/>
					<ChartTooltip
						cursor={false}
						content={
							<ChartTooltipContent
								indicator="dot"
								labelFormatter={(value) => {
									const date = new Date(value);
									if (granularity === Granularity.DAY) {
										return date.toLocaleDateString("en-US", {
											weekday: "short",
											month: "long",
											day: "numeric",
											year: "numeric",
										});
									} else if (granularity === Granularity.WEEK) {
										return `Week of ${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
									}
									return date.toLocaleDateString("en-US", {
										month: "long",
										year: "numeric",
									});
								}}
								formatter={(value) => (
									<span className="tabular-nums">
										$
										{Number(value).toLocaleString("en-US", {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}
									</span>
								)}
							/>
						}
					/>
					<defs>
						<linearGradient id="fillNetWorth" x1="0" y1="0" x2="0" y2="1">
							<stop
								offset="5%"
								stopColor="var(--color-netWorth)"
								stopOpacity={0.8}
							/>
							<stop
								offset="95%"
								stopColor="var(--color-netWorth)"
								stopOpacity={0.1}
							/>
						</linearGradient>
					</defs>
					<Area
						dataKey="netWorth"
						type="monotone"
						fill="url(#fillNetWorth)"
						fillOpacity={0.4}
						stroke="var(--color-netWorth)"
						strokeWidth={2}
					/>
				</AreaChart>
			</ChartContainer>
		</Card>
	);
}
