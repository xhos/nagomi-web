"use client";

import {
	addMonths,
	format,
	isSameMonth,
	startOfMonth,
	subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Accounts } from "@/components/dashboard/accounts";
import { AttentionList } from "@/components/dashboard/attention";
import { Figure, FigureRow } from "@/components/dashboard/figures";
import { PaceChart } from "@/components/dashboard/pace-chart";
import { Section } from "@/components/dashboard/section";
import { Upcoming } from "@/components/dashboard/upcoming";
import { WhereItWent } from "@/components/dashboard/where-it-went";
import { Button } from "@/components/ui/button";
import {
	PageContainer,
	PageContent,
	PageHeaderWithTitle,
} from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverview } from "@/hooks/useOverview";
import { useSession, useUserId } from "@/hooks/useSession";
import { formatCurrency } from "@/lib/utils/transaction";

const ordinal = (n: number) => {
	const s = ["th", "st", "nd", "rd"];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export default function OverviewPage() {
	const router = useRouter();
	const { data: session, isLoading: sessionLoading } = useSession();
	const userId = useUserId();
	const [month, setMonth] = useState(() => startOfMonth(new Date()));
	const o = useOverview(month);
	const now = new Date();
	const isNow = isSameMonth(month, now);

	useEffect(() => {
		if (!sessionLoading && !session?.data?.user) router.push("/login");
	}, [sessionLoading, session, router]);

	const money = (v: number) => formatCurrency(v, o.currency, 0);
	const spentNote = !o.throughDay
		? "Month hasn't started"
		: o.priorMonths === 0
			? "No earlier months to compare"
			: isNow
				? `Typical by the ${ordinal(o.throughDay)}: ${money(o.typicalNow)}`
				: `Typical month: ${money(o.typicalMonth)}`;
	const spentTone =
		o.throughDay && o.priorMonths
			? o.spent > o.typicalNow * 1.1
				? "bad"
				: o.spent < o.typicalNow * 0.9
					? "good"
					: undefined
			: undefined;

	return (
		<PageContainer>
			<PageContent>
				<PageHeaderWithTitle
					title="overview"
					actions={
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="icon"
								aria-label="Previous month"
								onClick={() => setMonth((m) => subMonths(m, 1))}
							>
								<ChevronLeft />
							</Button>
							<span className="w-36 text-center text-sm tabular-nums">
								{format(month, isNow ? "MMMM" : "MMMM yyyy")}
							</span>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Next month"
								disabled={isNow}
								onClick={() => setMonth((m) => addMonths(m, 1))}
							>
								<ChevronRight />
							</Button>
						</div>
					}
				/>

				{o.error && (
					<p className="mb-4 text-sm text-destructive">
						Couldn't load overview: {String(o.error)}
					</p>
				)}

				{o.isLoading || !userId ? (
					<div className="space-y-8">
						<div className="grid grid-cols-2 gap-6 border-y py-4 sm:grid-cols-4">
							{[0, 1, 2, 3].map((i) => (
								<div key={i} className="space-y-2">
									<Skeleton className="h-3 w-20" />
									<Skeleton className="h-7 w-32" />
									<Skeleton className="h-3 w-24" />
								</div>
							))}
						</div>
						<Skeleton className="h-64 w-full" />
						<Skeleton className="h-48 w-full" />
					</div>
				) : (
					<div className="space-y-10">
						<FigureRow>
							<Figure
								label="Net worth"
								value={money(o.netWorth)}
								note={`${o.netWorthDelta >= 0 ? "+" : "−"}${money(Math.abs(o.netWorthDelta))} in 30 days`}
								tone={o.netWorthDelta >= 0 ? "good" : "bad"}
							/>
							<Figure
								label={
									isNow ? "Spent so far" : `Spent in ${format(month, "MMMM")}`
								}
								value={money(o.spent)}
								note={spentNote}
								tone={spentTone}
							/>
							<Figure
								label={
									isNow
										? "Income this month"
										: `Income in ${format(month, "MMMM")}`
								}
								value={money(o.incomeMonth)}
								note={
									isNow && o.nextPayday
										? `Next payday ${format(o.nextPayday.next, "MMM d")}`
										: undefined
								}
							/>
							<Figure
								label="Cash available"
								value={money(o.cash)}
								note="Chequing and savings, less credit card"
							/>
						</FigureRow>

						<div className="grid gap-10 lg:grid-cols-3">
							<Section
								title="spending pace"
								note={`Cumulative, ${format(month, "MMMM")}`}
								className="lg:col-span-2"
							>
								<PaceChart
									data={o.pace}
									currency={o.currency}
									throughDay={o.throughDay}
									priorMonths={o.priorMonths}
								/>
							</Section>
							<Section title="needs attention">
								<AttentionList items={o.attention} currency={o.currency} />
							</Section>
						</div>

						<div className="grid gap-10 lg:grid-cols-2">
							<Section
								title="where it went"
								note={`vs ${o.priorMonths}-month average${isNow ? " to date" : ""}`}
							>
								<WhereItWent rows={o.whereItWent} currency={o.currency} />
							</Section>
							<Section title="upcoming" note="Detected from past activity">
								<Upcoming items={o.upcoming} currency={o.currency} />
							</Section>
						</div>

						<Section title="accounts" note="Last 30 days">
							<Accounts rows={o.accountRows} />
						</Section>
					</div>
				)}
			</PageContent>
		</PageContainer>
	);
}
