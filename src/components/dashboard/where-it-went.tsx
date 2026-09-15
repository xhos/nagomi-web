import type { CategorySpend } from "@/hooks/useOverview";
import { formatCurrency } from "@/lib/utils/transaction";

const label = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1);

export function WhereItWent({
	rows,
	currency,
}: {
	rows: CategorySpend[];
	currency: string;
}) {
	if (rows.length === 0)
		return (
			<p className="py-4 text-sm text-muted-foreground">No spending yet.</p>
		);
	const max = Math.max(...rows.map((r) => Math.max(r.amount, r.average)));
	return (
		<ul className="divide-y">
			{rows.map((r) => {
				const w = (r.amount / max) * 100;
				const a = (r.average / max) * 100;
				const delta = r.amount - r.average;
				return (
					<li
						key={r.slug}
						className="grid grid-cols-[7rem_1fr_auto] items-center gap-4 py-2.5 text-sm"
						title={`Average ${formatCurrency(r.average, currency, 0)}`}
					>
						<span className="truncate">{label(r.slug)}</span>
						<span className="relative block h-2.5 rounded-r-[4px] bg-muted">
							<span
								className="absolute inset-y-0 left-0 rounded-r-[4px] bg-accent"
								style={{ width: `${w}%` }}
							/>
							{r.average > 0 && (
								<span
									className="absolute -inset-y-1 w-0.5 bg-foreground/70"
									style={{ left: `calc(${a}% - 1px)` }}
								/>
							)}
						</span>
						<span className="w-36 text-right tabular-nums">
							{formatCurrency(r.amount, currency, 0)}
							<span className="ml-2 inline-block w-14 text-muted-foreground">
								{r.average > 0 && r.amount > 0 && Math.abs(delta) >= 1
									? `${delta >= 0 ? "+" : "−"}${formatCurrency(Math.abs(delta), currency, 0).replace(/^[A-Z]*\$/, "")}`
									: ""}
							</span>
						</span>
					</li>
				);
			})}
		</ul>
	);
}
