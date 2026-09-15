import Link from "next/link";
import type { AccountRow } from "@/hooks/useOverview";
import { accountTypeName } from "@/lib/utils/account";
import { formatCurrency } from "@/lib/utils/transaction";
import { Sparkline } from "./sparkline";

export function Accounts({ rows }: { rows: AccountRow[] }) {
	return (
		<ul className="divide-y">
			{rows.map(({ account, balance, series }) => (
				<li key={account.id.toString()}>
					<Link
						href="/accounts"
						className="-mx-3 flex items-center gap-4 rounded-md px-3 py-2.5 text-sm hover:bg-muted/60"
					>
						<span className="min-w-0 flex-1">
							<span className="block truncate font-medium">
								{account.friendlyName || account.name}
							</span>
							<span className="block truncate text-muted-foreground">
								{account.bank} · {accountTypeName(account.type)}
							</span>
						</span>
						<Sparkline
							values={series}
							className="hidden shrink-0 text-muted-foreground sm:block"
						/>
						<span className="w-32 text-right tabular-nums">
							{formatCurrency(balance, account.mainCurrency)}
						</span>
					</Link>
				</li>
			))}
		</ul>
	);
}
