"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Card, HStack, Muted, VStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import type { FriendBalance } from "@/gen/nagomi/v1/transaction_services_pb";
import { useUserId } from "@/hooks/useSession";
import { useForgiveTransaction } from "@/hooks/useSplits";
import { transactionsApi } from "@/lib/api/transactions";
import { cn } from "@/lib/utils";
import { formatAmount, formatCurrency } from "@/lib/utils/transaction";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

interface FriendBalanceCardProps {
	balance: FriendBalance;
}

export function FriendBalanceCard({ balance }: FriendBalanceCardProps) {
	const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const userId = useUserId();
	const { mutate: forgive, isPending: isForgiving } = useForgiveTransaction();

	const rawAmount =
		Number(balance.balance?.units ?? BigInt(0)) +
		(balance.balance?.nanos ?? 0) / 1e9;
	const currencyCode = balance.balance?.currencyCode ?? "USD";
	const formattedBalance = formatCurrency(Math.abs(rawAmount), currencyCode);
	const defaultPaymentAmount = Math.max(rawAmount, 0).toFixed(2);

	const { data: splitTransactions = [], isLoading: isLoadingSplits } = useQuery(
		{
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
			enabled: expanded && !!userId,
			staleTime: 2 * 60 * 1000,
		},
	);

	// Separate outstanding from payments/forgiven for the breakdown
	const outstandingSplits = splitTransactions.filter(
		(t) =>
			t.direction === TransactionDirection.DIRECTION_OUTGOING && !t.forgiven,
	);
	const forgivenSplits = splitTransactions.filter((t) => t.forgiven);
	const payments = splitTransactions.filter(
		(t) => t.direction === TransactionDirection.DIRECTION_INCOMING,
	);

	return (
		<>
			<Card variant="default" padding="md">
				<VStack spacing="md">
					<HStack spacing="md" justify="between" align="center">
						<VStack spacing="xs" align="start">
							<div className="text-sm font-semibold">{balance.friendName}</div>
							{rawAmount > 0.001 ? (
								<Muted
									size="xs"
									className="text-emerald-600 dark:text-emerald-400"
								>
									owes you {formattedBalance}
								</Muted>
							) : rawAmount < -0.001 ? (
								<Muted size="xs" className="text-destructive">
									you owe {formattedBalance}
								</Muted>
							) : (
								<Muted size="xs">settled up</Muted>
							)}
						</VStack>

						<HStack spacing="sm" align="center">
							{rawAmount > 0.001 && (
								<Button
									size="sm"
									variant="outline"
									onClick={() => setPaymentDialogOpen(true)}
								>
									<ArrowDownLeft className="h-3.5 w-3.5 mr-1.5" />
									record payment
								</Button>
							)}
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setExpanded((v) => !v)}
								className="h-7 w-7 p-0"
							>
								{expanded ? (
									<ChevronUp className="h-3.5 w-3.5" />
								) : (
									<ChevronDown className="h-3.5 w-3.5" />
								)}
							</Button>
						</HStack>
					</HStack>

					{expanded && (
						<div className="border-t border-border/60 pt-3 space-y-3">
							{isLoadingSplits ? (
								<Muted size="xs">loading...</Muted>
							) : splitTransactions.length === 0 ? (
								<Muted size="xs">no transactions</Muted>
							) : (
								<>
									{outstandingSplits.length > 0 && (
										<VStack spacing="xs">
											{outstandingSplits.map((tx) => (
												<HStack
													key={tx.id.toString()}
													justify="between"
													align="center"
													className="group"
												>
													<VStack
														spacing="xs"
														align="start"
														className="min-w-0"
													>
														<div className="text-xs font-medium truncate">
															{tx.description || tx.merchant || "split"}
														</div>
														<Muted size="xs">
															{tx.txDate?.seconds
																? new Date(
																		Number(tx.txDate.seconds) * 1000,
																	).toLocaleDateString()
																: ""}
														</Muted>
													</VStack>
													<HStack
														spacing="sm"
														align="center"
														className="shrink-0"
													>
														<span className="text-xs font-mono">
															{formatCurrency(
																formatAmount(tx.txAmount),
																tx.txAmount?.currencyCode,
															)}
														</span>
														<button
															onClick={() =>
																forgive({
																	transactionId: tx.id,
																	forgiven: true,
																})
															}
															disabled={isForgiving}
															className={cn(
																"text-[10px] text-muted-foreground/40 hover:text-muted-foreground",
																"transition-colors duration-150 opacity-0 group-hover:opacity-100",
															)}
														>
															forgive
														</button>
													</HStack>
												</HStack>
											))}
										</VStack>
									)}

									{payments.length > 0 && (
										<VStack spacing="xs">
											<Muted
												size="xs"
												className="uppercase tracking-wide text-[10px]"
											>
												payments
											</Muted>
											{payments.map((tx) => (
												<HStack
													key={tx.id.toString()}
													justify="between"
													align="center"
												>
													<VStack
														spacing="xs"
														align="start"
														className="min-w-0"
													>
														<div className="text-xs font-medium truncate">
															{tx.description || "payment"}
														</div>
														<Muted size="xs">
															{tx.txDate?.seconds
																? new Date(
																		Number(tx.txDate.seconds) * 1000,
																	).toLocaleDateString()
																: ""}
														</Muted>
													</VStack>
													<span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
														−
														{formatCurrency(
															formatAmount(tx.txAmount),
															tx.txAmount?.currencyCode,
														)}
													</span>
												</HStack>
											))}
										</VStack>
									)}

									{forgivenSplits.length > 0 && (
										<VStack spacing="xs">
											<Muted
												size="xs"
												className="uppercase tracking-wide text-[10px]"
											>
												forgiven
											</Muted>
											{forgivenSplits.map((tx) => (
												<HStack
													key={tx.id.toString()}
													justify="between"
													align="center"
													className="group opacity-50"
												>
													<VStack
														spacing="xs"
														align="start"
														className="min-w-0"
													>
														<div className="text-xs font-medium truncate line-through">
															{tx.description || tx.merchant || "split"}
														</div>
														<Muted size="xs">
															{tx.txDate?.seconds
																? new Date(
																		Number(tx.txDate.seconds) * 1000,
																	).toLocaleDateString()
																: ""}
														</Muted>
													</VStack>
													<HStack
														spacing="sm"
														align="center"
														className="shrink-0"
													>
														<span className="text-xs font-mono line-through">
															{formatCurrency(
																formatAmount(tx.txAmount),
																tx.txAmount?.currencyCode,
															)}
														</span>
														<button
															onClick={() =>
																forgive({
																	transactionId: tx.id,
																	forgiven: false,
																})
															}
															disabled={isForgiving}
															className={cn(
																"text-[10px] text-muted-foreground/40 hover:text-muted-foreground",
																"transition-colors duration-150 opacity-0 group-hover:opacity-100",
															)}
														>
															un-forgive
														</button>
													</HStack>
												</HStack>
											))}
										</VStack>
									)}
								</>
							)}
						</div>
					)}
				</VStack>
			</Card>

			<RecordPaymentDialog
				open={paymentDialogOpen}
				onOpenChange={setPaymentDialogOpen}
				friendAccountId={balance.accountId}
				friendName={balance.friendName}
				defaultAmount={defaultPaymentAmount}
				defaultCurrency={currencyCode}
			/>
		</>
	);
}
