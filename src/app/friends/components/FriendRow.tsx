"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { ListRow } from "@/components/ui/list";
import { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import type { FriendBalance } from "@/gen/nagomi/v1/transaction_services_pb";
import { useUserId } from "@/hooks/useSession";
import { useForgiveTransaction } from "@/hooks/useSplits";
import { transactionsApi } from "@/lib/api/transactions";
import { cn } from "@/lib/utils";
import { formatAmount } from "@/lib/utils/transaction";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

const when = (t?: { seconds?: bigint }) =>
	t?.seconds ? format(new Date(Number(t.seconds) * 1000), "MMM d, yyyy") : "";

function Splits({
	title,
	items,
	action,
	onAction,
	muted,
	tone,
}: {
	title: string;
	items: Transaction[];
	action: string;
	onAction: (t: Transaction) => void;
	muted?: boolean;
	tone: "in" | "out" | "neutral";
}) {
	if (items.length === 0) return null;
	return (
		<div className={cn(muted && "opacity-60")}>
			<div className="border-b pb-1 text-sm font-medium">{title}</div>
			<div className="divide-y">
				{items.map((t) => (
					<div
						key={t.id.toString()}
						className="group/split flex items-center gap-3 py-1.5 text-sm"
					>
						<span className="min-w-0 flex-1">
							<span className={cn("block truncate", muted && "line-through")}>
								{t.description || t.merchant || "Split"}
							</span>
							<span className="block text-muted-foreground">
								{when(t.txDate)}
							</span>
						</span>
						<button
							type="button"
							onClick={() => onAction(t)}
							className="text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover/split:opacity-100"
						>
							{action}
						</button>
						<Amount
							value={formatAmount(t.txAmount)}
							currency={t.txAmount?.currencyCode}
							tone={tone}
							className={cn(muted && "line-through")}
						/>
					</div>
				))}
			</div>
		</div>
	);
}

export function FriendRow({
	balance,
	expanded,
	onToggle,
}: {
	balance: FriendBalance;
	expanded: boolean;
	onToggle: () => void;
}) {
	const userId = useUserId();
	const [paying, setPaying] = useState(false);
	const { mutate: forgive } = useForgiveTransaction();
	const amount = formatAmount(balance.balance);
	const currency = balance.balance?.currencyCode;
	const owesYou = amount > 0.001;
	const youOwe = amount < -0.001;

	const { data: txs = [], isLoading } = useQuery({
		queryKey: ["friendSplits", balance.accountId.toString(), userId],
		queryFn: async () => {
			if (!userId) throw new Error("not authenticated");
			return (
				await transactionsApi.list({
					userId,
					accountId: balance.accountId,
					limit: 100,
				})
			).transactions;
		},
		enabled: expanded && !!userId,
		staleTime: 2 * 60 * 1000,
	});
	// on a friend account, incoming adds to what they owe you; outgoing is them paying you back
	const outstanding = txs.filter(
		(t) =>
			t.direction === TransactionDirection.DIRECTION_INCOMING && !t.forgiven,
	);
	const payments = txs.filter(
		(t) => t.direction === TransactionDirection.DIRECTION_OUTGOING,
	);
	const forgiven = txs.filter((t) => t.forgiven);

	return (
		<>
			<ListRow expanded={expanded} onClick={onToggle}>
				<div className="flex items-start gap-3">
					<div className="min-w-0 flex-1">
						<div className="truncate font-medium">{balance.friendName}</div>
						<div className="text-sm text-muted-foreground">
							{owesYou ? "Owes you" : youOwe ? "You owe" : "Settled up"}
						</div>
					</div>
					{(owesYou || youOwe) && (
						<Amount
							value={Math.abs(amount)}
							currency={currency}
							tone={owesYou ? "in" : "out"}
							className="font-medium"
						/>
					)}
				</div>

				{expanded && (
					<div
						className="mt-3 space-y-4 border-t pt-3"
						onClick={(e) => e.stopPropagation()}
					>
						{isLoading ? (
							<p className="text-sm text-muted-foreground">Loading…</p>
						) : txs.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No shared expenses yet.
							</p>
						) : (
							<>
								<Splits
									title="outstanding"
									items={outstanding}
									action="Forgive"
									onAction={(t) =>
										forgive({ transactionId: t.id, forgiven: true })
									}
									tone="neutral"
								/>
								<Splits
									title="payments"
									items={payments}
									action=""
									onAction={() => {}}
									tone="in"
								/>
								<Splits
									title="forgiven"
									items={forgiven}
									action="Undo"
									onAction={(t) =>
										forgive({ transactionId: t.id, forgiven: false })
									}
									muted
									tone="neutral"
								/>
							</>
						)}
						{owesYou && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setPaying(true)}
							>
								Record payment
							</Button>
						)}
					</div>
				)}
			</ListRow>
			<RecordPaymentDialog
				open={paying}
				onOpenChange={setPaying}
				friendAccountId={balance.accountId}
				friendName={balance.friendName}
				defaultAmount={Math.max(amount, 0).toFixed(2)}
				defaultCurrency={currency ?? ""}
			/>
		</>
	);
}
