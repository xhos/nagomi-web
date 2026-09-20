import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Attention } from "@/hooks/useOverview";
import { formatCurrency } from "@/lib/utils/transaction";

export function AttentionList({
	items,
	currency,
}: {
	items: Attention[];
	currency: string;
}) {
	if (items.length === 0)
		return (
			<p className="py-4 text-sm text-muted-foreground">
				Nothing needs your attention.
			</p>
		);
	return (
		<ul className="divide-y">
			{items.map((item) => (
				<li key={`${item.kind}:${item.text}`}>
					<Link
						href={item.href}
						className="group -mx-3 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-muted/60"
					>
						<span className="min-w-0 flex-1 truncate">{item.text}</span>
						{item.amount !== undefined && (
							<span className="tabular-nums">
								{formatCurrency(item.amount, currency)}
								{item.originalAmount !== undefined &&
									item.originalCurrency !== currency && (
										<span className="block text-right text-muted-foreground">
											{formatCurrency(
												item.originalAmount,
												item.originalCurrency,
											)}{" "}
											{item.originalCurrency}
										</span>
									)}
							</span>
						)}
						<ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
					</Link>
				</li>
			))}
		</ul>
	);
}
