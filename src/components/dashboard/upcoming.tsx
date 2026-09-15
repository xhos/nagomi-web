import { format, isToday, isTomorrow } from "date-fns";
import { Amount } from "@/components/ui/amount";
import { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import type { Recurring } from "@/hooks/useOverview";
import { formatCurrency } from "@/lib/utils/transaction";

const when = (d: Date) =>
	isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "EEE, MMM d");

export function Upcoming({
	items,
	currency,
}: {
	items: Recurring[];
	currency: string;
}) {
	if (items.length === 0)
		return (
			<p className="py-4 text-sm text-muted-foreground">
				No recurring payments detected yet.
			</p>
		);
	const out = items
		.filter((i) => i.direction === TransactionDirection.DIRECTION_OUTGOING)
		.reduce((n, i) => n + i.amount, 0);
	const inn = items
		.filter((i) => i.direction === TransactionDirection.DIRECTION_INCOMING)
		.reduce((n, i) => n + i.amount, 0);
	return (
		<div>
			<ul className="divide-y">
				{items.map((i) => (
					<li
						key={`${i.direction}:${i.merchant}`}
						className="flex items-center gap-4 py-2.5 text-sm"
					>
						<span className="w-28 shrink-0 text-muted-foreground">
							{when(i.next)}
						</span>
						<span className="min-w-0 flex-1 truncate">{i.merchant}</span>
						<span className="tabular-nums">
							{i.approximate && (
								<span className="mr-1 text-muted-foreground">≈</span>
							)}
							<Amount
								value={Math.round(i.amount)}
								currency={currency}
								tone={
									i.direction === TransactionDirection.DIRECTION_INCOMING
										? "in"
										: "out"
								}
							/>
						</span>
					</li>
				))}
			</ul>
			<p className="pt-3 text-sm text-muted-foreground">
				Next 30 days: {formatCurrency(out, currency, 0)} out
				{inn > 0 && `, ${formatCurrency(inn, currency, 0)} in`}
			</p>
		</div>
	);
}
