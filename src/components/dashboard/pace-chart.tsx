"use client";

import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { PacePoint } from "@/hooks/useOverview";
import { formatCurrency } from "@/lib/utils/transaction";

interface PaceChartProps {
	data: PacePoint[];
	currency: string;
	throughDay: number;
	priorMonths: number;
}

const compact = (v: number) =>
	v >= 1000
		? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`
		: `${Math.round(v)}`;

export function PaceChart({
	data,
	currency,
	throughDay,
	priorMonths,
}: PaceChartProps) {
	const ticks = [1, 8, 15, 22, data.length];
	return (
		<div>
			<div className="flex items-center gap-4 py-3 text-sm text-muted-foreground">
				<span className="flex items-center gap-2">
					<span className="h-0.5 w-4 rounded-full bg-accent" />
					This month
				</span>
				<span className="flex items-center gap-2">
					<span className="h-0.5 w-4 rounded-full bg-muted-foreground/60" />
					Typical ({priorMonths}-month average)
				</span>
			</div>
			<div className="h-56 w-full text-xs text-muted-foreground">
				<ResponsiveContainer width="100%" height="100%">
					<LineChart
						data={data}
						margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
					>
						<CartesianGrid vertical={false} stroke="var(--border)" />
						<XAxis
							dataKey="day"
							ticks={ticks}
							tickLine={false}
							axisLine={{ stroke: "var(--border)" }}
							tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
							tickMargin={8}
						/>
						<YAxis
							tickFormatter={compact}
							tickLine={false}
							axisLine={false}
							width={40}
							tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
						/>
						<Tooltip
							cursor={{ stroke: "var(--border)" }}
							content={({ active, payload, label }) => {
								if (!active || !payload?.length) return null;
								const row = payload[0].payload as PacePoint;
								return (
									<div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
										<div className="mb-1 text-muted-foreground">
											Day {label}
										</div>
										{row.current !== undefined && (
											<div className="flex items-center justify-between gap-6">
												<span className="flex items-center gap-2">
													<span className="h-0.5 w-3 rounded-full bg-accent" />
													This month
												</span>
												<span className="font-medium tabular-nums">
													{formatCurrency(row.current, currency, 0)}
												</span>
											</div>
										)}
										<div className="flex items-center justify-between gap-6">
											<span className="flex items-center gap-2">
												<span className="h-0.5 w-3 rounded-full bg-muted-foreground/60" />
												Typical
											</span>
											<span className="font-medium tabular-nums">
												{formatCurrency(row.typical, currency, 0)}
											</span>
										</div>
									</div>
								);
							}}
						/>
						<Line
							type="monotone"
							dataKey="typical"
							stroke="var(--muted-foreground)"
							strokeOpacity={0.6}
							strokeWidth={2}
							dot={false}
							activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
							isAnimationActive={false}
						/>
						<Line
							type="monotone"
							dataKey="current"
							stroke="var(--accent)"
							strokeWidth={2}
							dot={(p) =>
								p.index === throughDay - 1 ? (
									<circle
										key={p.key}
										cx={p.cx}
										cy={p.cy}
										r={4}
										fill="var(--accent)"
										stroke="var(--background)"
										strokeWidth={2}
									/>
								) : (
									<g key={p.key} />
								)
							}
							activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
							isAnimationActive={false}
						/>
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
