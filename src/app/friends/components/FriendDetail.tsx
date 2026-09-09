"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft } from "lucide-react";
import { useState } from "react";
import { Amount, Card, HStack, Muted, Text, VStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import type { FriendBalance } from "@/gen/nagomi/v1/transaction_services_pb";
import { useUserId } from "@/hooks/useSession";
import { useForgiveTransaction } from "@/hooks/useSplits";
import { transactionsApi } from "@/lib/api/transactions";
import { cn } from "@/lib/utils";
import {
	formatAmount,
	formatCurrency,
	formatTime,
} from "@/lib/utils/transaction";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

interface FriendDetailProps {
	balance: FriendBalance;
}

export function FriendDetail({ balance }: FriendDetailProps) {
	const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
	const userId = useUserId();
	const { mutate: forgive, isPending: isForgiving } = useForgiveTransaction();

	const rawAmount =
		Number(balance.balance?.units ?? BigInt(0)) +
		(balance.balance?.nanos ?? 0) / 1e9;
	const currencyCode = balance.balance?.currencyCode;
	const defaultPaymentAmount = Math.max(rawAmount, 0).toFixed(2);

	const { data: transactions = [], isLoading } = useQuery({
		queryKey: ["friendSplits", balance.accountId.toString(), userId],
		queryFn: async () => {
			if (!userId) throw new Error("not authenticated");
			const result = await transactionsApi.list({
				userId,
				accountId: balance.accountId,
				limit: 100,
			});
			return result.transactions;
		},
		enabled: !!userId,
		staleTime: 2 * 60 * 1000,
	});

	const outstandingSplits = transactions.filter(
		(t) =>
			t.direction === TransactionDirection.DIRECTION_OUTGOING && !t.forgiven,
	);
	const payments = transactions.filter(
		(t) => t.direction === TransactionDirection.DIRECTION_INCOMING,
	);
	const forgivenSplits = transactions.filter((t) => t.forgiven);

	return (
		<>
			<VStack spacing="xl">
				<HStack spacing="md" justify="between" align="start">
					<VStack spacing="xs" align="start">
						{rawAmount > 0.001 ? (
							<>
								<Muted size="xs">owes you</Muted>
								<Text
									size="lg"
									weight="semibold"
									className="font-mono text-emerald-600 dark:text-emerald-400"
								>
									{formatCurrency(rawAmount, currencyCode)}
								</Text>
							</>
						) : rawAmount < -0.001 ? (
							<>
								<Muted size="xs">you owe</Muted>
								<Text
									size="lg"
									weight="semibold"
									className="font-mono text-destructive"
								>
									{formatCurrency(Math.abs(rawAmount), currencyCode)}
								</Text>
							</>
						) : (
							<Text
								size="lg"
								weight="semibold"
								className="text-muted-foreground"
							>
								settled up
							</Text>
						)}
					</VStack>

					{rawAmount > 0.001 && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setPaymentDialogOpen(true)}
						>
							<ArrowDownLeft className="h-3.5 w-3.5 mr-1.5" />
							record payment
						</Button>
					)}
				</HStack>

				{isLoading ? (
					<Muted size="sm">loading...</Muted>
				) : transactions.length === 0 ? (
					<Muted size="sm">no transactions yet</Muted>
				) : (
					<VStack spacing="lg">
						{outstandingSplits.length > 0 && (
							<VStack spacing="sm">
								<span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">
									outstanding
								</span>
								<VStack spacing="xs">
									{outstandingSplits.map((tx) => (
										<Card key={tx.id.toString()} variant="default" padding="sm">
											<HStack spacing="xl" justify="between" className="group">
												<VStack
													spacing="xs"
													align="start"
													className="flex-1 min-w-0"
												>
													<div className="text-sm font-semibold truncate">
														{tx.description || tx.merchant || "split"}
													</div>
													<Muted size="xs">{formatTime(tx.txDate)}</Muted>
												</VStack>
												<HStack
													spacing="md"
													align="center"
													className="shrink-0"
												>
													<button
														onClick={() =>
															forgive({ transactionId: tx.id, forgiven: true })
														}
														disabled={isForgiving}
														className={cn(
															"text-xs text-muted-foreground/40 hover:text-muted-foreground",
															"transition-colors duration-150 opacity-0 group-hover:opacity-100",
														)}
													>
														forgive
													</button>
													<Amount
														value={formatAmount(tx.txAmount)}
														currency={tx.txAmount?.currencyCode}
														variant="negative"
													/>
												</HStack>
											</HStack>
										</Card>
									))}
								</VStack>
							</VStack>
						)}

						{payments.length > 0 && (
							<VStack spacing="sm">
								<span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">
									payments
								</span>
								<VStack spacing="xs">
									{payments.map((tx) => (
										<Card key={tx.id.toString()} variant="default" padding="sm">
											<HStack spacing="xl" justify="between">
												<VStack
													spacing="xs"
													align="start"
													className="flex-1 min-w-0"
												>
													<div className="text-sm font-semibold truncate">
														{tx.description || "payment"}
													</div>
													<Muted size="xs">{formatTime(tx.txDate)}</Muted>
												</VStack>
												<Amount
													value={formatAmount(tx.txAmount)}
													currency={tx.txAmount?.currencyCode}
													variant="positive"
												/>
											</HStack>
										</Card>
									))}
								</VStack>
							</VStack>
						)}

						{forgivenSplits.length > 0 && (
							<VStack spacing="sm">
								<span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">
									forgiven
								</span>
								<VStack spacing="xs" className="opacity-50">
									{forgivenSplits.map((tx) => (
										<Card key={tx.id.toString()} variant="default" padding="sm">
											<HStack spacing="xl" justify="between" className="group">
												<VStack
													spacing="xs"
													align="start"
													className="flex-1 min-w-0"
												>
													<div className="text-sm font-semibold truncate line-through">
														{tx.description || tx.merchant || "split"}
													</div>
													<Muted size="xs">{formatTime(tx.txDate)}</Muted>
												</VStack>
												<HStack
													spacing="md"
													align="center"
													className="shrink-0"
												>
													<button
														onClick={() =>
															forgive({ transactionId: tx.id, forgiven: false })
														}
														disabled={isForgiving}
														className={cn(
															"text-xs text-muted-foreground/40 hover:text-muted-foreground",
															"transition-colors duration-150 opacity-0 group-hover:opacity-100",
														)}
													>
														un-forgive
													</button>
													<Amount
														value={formatAmount(tx.txAmount)}
														currency={tx.txAmount?.currencyCode}
														variant="negative"
														className="line-through"
													/>
												</HStack>
											</HStack>
										</Card>
									))}
								</VStack>
							</VStack>
						)}
					</VStack>
				)}
			</VStack>

			<RecordPaymentDialog
				open={paymentDialogOpen}
				onOpenChange={setPaymentDialogOpen}
				friendAccountId={balance.accountId}
				friendName={balance.friendName}
				defaultAmount={defaultPaymentAmount}
				defaultCurrency={currencyCode ?? ""}
			/>
		</>
	);
}
