"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
	Amount,
	EmptyState,
	LoadingSkeleton,
	Muted,
	VStack,
} from "@/components/lib";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useTransactionsQuery } from "@/hooks/useTransactionsQuery";
import {
	formatCurrency,
	groupTransactionsByDay,
} from "@/lib/utils/transaction";
import { DayHeader } from "./TransactionCard";
import type { TransactionFilters } from "./TransactionFiltersDialog";
import { TransactionItem } from "./TransactionItem";

interface TransactionListProps {
	accountId?: bigint;
	searchQuery?: string;
	filters?: TransactionFilters;
	onSelectionChange?: (selectedTransactions: Transaction[]) => void;
	onEditTransaction?: (transaction: Transaction) => void;
	onDeleteTransaction?: (transaction: Transaction) => void;
	onViewDetails?: (transaction: Transaction) => void;
	onSplitTransaction?: (transaction: Transaction) => void;
	onCreateRule?: (transaction: Transaction) => void;
}

function throttle(func: (...args: unknown[]) => void, limit: number) {
	let inThrottle: boolean;
	return function (this: unknown, ...args: unknown[]) {
		if (!inThrottle) {
			func.apply(this, args);
			inThrottle = true;
			setTimeout(() => {
				inThrottle = false;
			}, limit);
		}
	};
}

export function TransactionList({
	accountId,
	searchQuery,
	filters,
	onSelectionChange,
	onEditTransaction,
	onDeleteTransaction,
	onViewDetails,
	onSplitTransaction,
	onCreateRule,
}: TransactionListProps) {
	const { transactions, isLoading, isLoadingMore, error, hasMore, loadMore } =
		useTransactionsQuery({ accountId, searchQuery, filters });

	const { getAccountDisplayName } = useAccounts();
	const { categoryMap } = useCategories();
	const observerRef = useRef<IntersectionObserver | null>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);

	// Group splits under their source transaction when both are in the list.
	// This hides split rows from the top level and renders them inline.
	const { splitMap, topLevelTransactions } = useMemo(() => {
		const sourceIdsInList = new Set(transactions.map((t) => t.id.toString()));
		const map = new Map<string, Transaction[]>();

		for (const tx of transactions) {
			if (tx.splitFromId && sourceIdsInList.has(tx.splitFromId.toString())) {
				const key = tx.splitFromId.toString();
				if (!map.has(key)) map.set(key, []);
				map.get(key)?.push(tx);
			}
		}

		const topLevel = transactions.filter(
			(tx) =>
				!tx.splitFromId || !sourceIdsInList.has(tx.splitFromId.toString()),
		);

		return { splitMap: map, topLevelTransactions: topLevel };
	}, [transactions]);

	const { isSelected, toggleSelection, hasSelection, toggleItems } =
		useMultiSelect({
			items: topLevelTransactions,
			getId: (transaction) => transaction.id,
		});

	const enrichTransaction = useCallback(
		(transaction: Transaction) => {
			if (transaction.categoryId && !transaction.category) {
				const category = categoryMap.get(transaction.categoryId.toString());
				if (category) {
					return { ...transaction, category };
				}
			}
			return transaction;
		},
		[categoryMap],
	);

	const handleDayHeaderClick = useCallback(
		(event: React.MouseEvent, dayTransactions: Transaction[]) => {
			if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
				return;
			}

			event.preventDefault();

			const firstTransactionId = dayTransactions[0]?.id;
			if (!firstTransactionId) return;

			let firstGlobalIndex = 0;
			for (const transaction of transactions) {
				if (transaction.id === firstTransactionId) break;
				firstGlobalIndex++;
			}

			if (event.shiftKey) {
				toggleSelection(
					dayTransactions[dayTransactions.length - 1].id,
					firstGlobalIndex + dayTransactions.length - 1,
					event,
				);
			} else {
				const dayTransactionIds = dayTransactions.map((t) => t.id);
				toggleItems(dayTransactionIds);
			}
		},
		[transactions, toggleSelection, toggleItems],
	);

	const selectedTransactions = useMemo(
		() =>
			topLevelTransactions.filter((transaction) => isSelected(transaction.id)),
		[topLevelTransactions, isSelected],
	);

	useEffect(() => {
		onSelectionChange?.(selectedTransactions);
	}, [selectedTransactions, onSelectionChange]);

	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel || isLoadingMore) return;

		if (observerRef.current) observerRef.current.disconnect();

		observerRef.current = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
					loadMore();
				}
			},
			{
				rootMargin: "400px 0px 400px 0px",
				threshold: 0,
			},
		);

		observerRef.current.observe(sentinel);

		return () => {
			if (observerRef.current) {
				observerRef.current.disconnect();
			}
		};
	}, [hasMore, isLoadingMore, loadMore]);

	useEffect(() => {
		if (!hasMore || isLoadingMore) return;

		const handleScroll = () => {
			const scrollTop =
				window.pageYOffset || document.documentElement.scrollTop;
			const scrollHeight = document.documentElement.scrollHeight;
			const clientHeight = document.documentElement.clientHeight;

			if (scrollHeight - scrollTop - clientHeight < 800) {
				loadMore();
			}
		};

		const throttledHandleScroll = throttle(handleScroll, 200);
		window.addEventListener("scroll", throttledHandleScroll, { passive: true });

		return () => {
			window.removeEventListener("scroll", throttledHandleScroll);
		};
	}, [hasMore, isLoadingMore, loadMore]);

	if (isLoading) {
		return <LoadingSkeleton lines={5} />;
	}

	if (error) {
		return (
			<div className="rounded-sm border border-destructive/50 bg-destructive/5 p-4">
				<p className="text-sm text-destructive">{String(error)}</p>
			</div>
		);
	}

	const groupedTransactions = groupTransactionsByDay(topLevelTransactions);

	if (groupedTransactions.length === 0) {
		return (
			<EmptyState
				title="no transactions yet"
				description={
					accountId
						? "no transactions found for this account"
						: "connect your accounts to start tracking transactions"
				}
			/>
		);
	}

	return (
		<VStack spacing="2xl">
			{groupedTransactions.map((group, groupIndex) => {
				const currencyCode = group.transactions[0]?.txAmount?.currencyCode;

				return (
					<VStack key={group.date} spacing="xs">
						<DayHeader
							selectable={hasSelection}
							onClick={(event) =>
								handleDayHeaderClick(event, group.transactions)
							}
							title={
								hasSelection
									? "Ctrl+click to select all transactions in this day, Shift+click for range selection"
									: ""
							}
						>
							<div>
								<div className="text-sm font-semibold tracking-tight">
									{group.displayDate}
								</div>
								<Muted size="xs" className="mt-1">
									{group.transactions.length} transaction
									{group.transactions.length !== 1 ? "s" : ""}
								</Muted>
							</div>
							<div className="text-right space-y-1">
								<div className="flex items-center gap-2.5 text-sm">
									<Amount
										value={parseFloat(
											formatCurrency(group.totalIn, currencyCode).replace(
												/[^0-9.-]/g,
												"",
											),
										)}
										variant="positive"
									/>
									<Muted size="xs">/</Muted>
									<Amount
										value={parseFloat(
											formatCurrency(group.totalOut, currencyCode).replace(
												/[^0-9.-]/g,
												"",
											),
										)}
										variant="negative"
									/>
								</div>
								<div className="text-xs">
									<Muted size="xs" className="mr-1.5">
										net:
									</Muted>
									<Amount
										value={parseFloat(
											formatCurrency(group.netAmount, currencyCode).replace(
												/[^0-9.-]/g,
												"",
											),
										)}
										variant={group.netAmount >= 0 ? "positive" : "negative"}
									/>
								</div>
							</div>
						</DayHeader>

						<VStack spacing="sm">
							{group.transactions.map((transaction, localIndex) => {
								const isTransactionSelected = isSelected(transaction.id);

								let globalIndex = 0;
								for (let i = 0; i < groupIndex; i++) {
									globalIndex += groupedTransactions[i].transactions.length;
								}
								globalIndex += localIndex;

								return (
									<TransactionItem
										key={transaction.id.toString()}
										transaction={enrichTransaction(transaction)}
										isSelected={isTransactionSelected}
										onSelect={toggleSelection}
										globalIndex={globalIndex}
										getAccountDisplayName={getAccountDisplayName}
										onEdit={onEditTransaction}
										onDelete={onDeleteTransaction}
										onViewDetails={onViewDetails}
										onSplit={onSplitTransaction}
										onCreateRule={onCreateRule}
										inlineSplits={splitMap.get(transaction.id.toString())}
									/>
								);
							})}
						</VStack>
					</VStack>
				);
			})}

			{hasMore && <div ref={sentinelRef} className="h-4" />}

			{isLoadingMore && (
				<div className="py-6 text-center">
					<Muted>loading more...</Muted>
				</div>
			)}

			{!hasMore && groupedTransactions.length > 0 && (
				<div className="py-6 text-center border-t">
					<Muted size="xs">all transactions loaded</Muted>
				</div>
			)}
		</VStack>
	);
}
