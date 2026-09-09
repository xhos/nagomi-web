"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";
import { HStack, Muted, VStack } from "@/components/lib";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import {
	type ListTransactionsInput,
	transactionsApi,
} from "@/lib/api/transactions";
import { formatAmount } from "@/lib/utils/transaction";

interface CategoryTransactionsSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	userId: string;
	categorySlug: string | null;
	categoryName: string;
	categoryColor: string;
	startDate?: Date;
	endDate?: Date;
}

export function CategoryTransactionsSheet({
	open,
	onOpenChange,
	userId,
	categorySlug,
	categoryName,
	categoryColor,
	startDate,
	endDate,
}: CategoryTransactionsSheetProps) {
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!open) return;

		const fetchTransactions = async () => {
			setLoading(true);
			try {
				const params: ListTransactionsInput = {
					userId,
					startDate,
					endDate,
					limit: 20,
					direction: TransactionDirection.DIRECTION_OUTGOING,
				};

				if (categorySlug !== null) {
					params.categories = [categorySlug];
				} else {
					params.uncategorized = true;
				}

				const response = await transactionsApi.list(params);
				const sortedTransactions = [...response.transactions].sort((a, b) => {
					const amountA = formatAmount(a.txAmount);
					const amountB = formatAmount(b.txAmount);
					return amountB - amountA;
				});
				setTransactions(sortedTransactions);
			} catch (err) {
				console.error("Failed to fetch transactions:", err);
			} finally {
				setLoading(false);
			}
		};

		fetchTransactions();
	}, [open, userId, categorySlug, startDate, endDate]);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="sm:max-w-lg">
				<SheetHeader>
					<div className="flex items-center gap-2">
						<div
							className="w-4 h-4 rounded"
							style={{ backgroundColor: categoryColor }}
						/>
						<SheetTitle>{categoryName}</SheetTitle>
					</div>
					<SheetDescription>
						Recent transactions
						{startDate && endDate && (
							<>
								{" "}
								from {format(startDate, "MMM d")} to {format(endDate, "MMM d")}
							</>
						)}
					</SheetDescription>
				</SheetHeader>

				<VStack spacing="md" className="mt-6">
					{loading &&
						[...Array(5)].map((_, i) => (
							<Skeleton key={i} className="h-16 w-full" />
						))}

					{!loading && transactions.length === 0 && (
						<div className="flex items-center justify-center py-8">
							<div className="font-mono text-xs text-muted-foreground">
								no transactions found
							</div>
						</div>
					)}

					{!loading &&
						transactions.map((tx) => {
							const amount = formatAmount(tx.txAmount);
							const isIncoming =
								(typeof tx.direction === "string"
									? TransactionDirection[
											tx.direction as keyof typeof TransactionDirection
										]
									: tx.direction) === TransactionDirection.DIRECTION_INCOMING;

							return (
								<HStack
									key={tx.id}
									spacing="md"
									justify="between"
									align="start"
									className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
								>
									<VStack spacing="xs" className="flex-1 min-w-0">
										<p className="font-medium truncate">
											{tx.merchant || tx.description || "Unknown"}
										</p>
										{tx.description && tx.merchant && (
											<Muted size="xs">{tx.description}</Muted>
										)}
										<Muted size="xs">
											{tx.txDate &&
												format(
													new Date(Number(tx.txDate.seconds) * 1000),
													"MMM d, yyyy",
												)}
										</Muted>
									</VStack>
									<VStack spacing="xs" align="end" className="flex-shrink-0">
										<p
											className={`font-semibold ${isIncoming ? "text-green-600" : ""}`}
										>
											{isIncoming ? "+" : "-"}${amount.toFixed(2)}
										</p>
										{tx.accountName && (
											<Muted size="xs">{tx.accountName}</Muted>
										)}
									</VStack>
								</HStack>
							);
						})}
				</VStack>
			</SheetContent>
		</Sheet>
	);
}
