"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	PageContainer,
	PageContent,
	PageHeaderWithTitle,
} from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountType } from "@/gen/nagomi/v1/enums_pb";
import { useAccounts } from "@/hooks/useAccounts";
import { useFriendBalances } from "@/hooks/useSplits";
import { formatAmount, formatCurrency } from "@/lib/utils/transaction";
import { FriendRow } from "./components/FriendRow";

export default function FriendsPage() {
	const { data: balances = [], isLoading, error } = useFriendBalances();
	const { accounts } = useAccounts();
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const hasFriends = accounts.some(
		(a) => a.type === AccountType.ACCOUNT_FRIEND,
	);

	const owed = balances.reduce(
		(n, b) => n + Math.max(0, formatAmount(b.balance)),
		0,
	);
	const owing = balances.reduce(
		(n, b) => n + Math.max(0, -formatAmount(b.balance)),
		0,
	);
	const currency = balances.find((b) => b.balance?.currencyCode)?.balance
		?.currencyCode;
	const sorted = [...balances].sort(
		(a, b) => formatAmount(b.balance) - formatAmount(a.balance),
	);

	return (
		<PageContainer>
			<PageContent>
				<PageHeaderWithTitle
					title="friends"
					subtitle={
						owed || owing
							? [
									owed
										? `${formatCurrency(owed, currency, 0)} owed to you`
										: "",
									owing ? `you owe ${formatCurrency(owing, currency, 0)}` : "",
								]
									.filter(Boolean)
									.join(" · ")
							: undefined
					}
				/>

				{error && (
					<p className="mb-4 text-sm text-destructive">
						Couldn't load balances: {error.message}
					</p>
				)}

				{isLoading ? (
					<div className="divide-y">
						{[0, 1, 2].map((i) => (
							<div key={i} className="flex justify-between py-2">
								<div className="space-y-2">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-3 w-16" />
								</div>
								<Skeleton className="h-4 w-20" />
							</div>
						))}
					</div>
				) : !hasFriends ? (
					<div className="flex flex-col items-center gap-3 py-16 text-center">
						<p className="text-sm text-muted-foreground">
							Add a friend account to track shared expenses.
						</p>
						<Button asChild variant="outline" size="sm">
							<Link href="/accounts">Go to accounts</Link>
						</Button>
					</div>
				) : (
					<div className="divide-y border-t">
						{sorted.map((b) => (
							<FriendRow
								key={b.accountId.toString()}
								balance={b}
								expanded={expandedId === b.accountId.toString()}
								onToggle={() =>
									setExpandedId((cur) =>
										cur === b.accountId.toString()
											? null
											: b.accountId.toString(),
									)
								}
							/>
						))}
					</div>
				)}
			</PageContent>
		</PageContainer>
	);
}
