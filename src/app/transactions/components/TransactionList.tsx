"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, ListGroup } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useTransactionsQuery } from "@/hooks/useTransactionsQuery";
import { groupTransactionsByDay } from "@/lib/utils/transaction";
import { SelectionBar } from "./SelectionBar";
import type { TransactionFilters } from "./TransactionFiltersPanel";
import { TransactionItem } from "./TransactionItem";

interface TransactionListProps {
	accountId?: bigint;
	searchQuery?: string;
	filters?: TransactionFilters;
	onCreate?: () => void;
	onDeleteMany?: (transactions: Transaction[]) => Promise<void>;
	onEditTransaction?: (transaction: Transaction) => void;
	onDeleteTransaction?: (transaction: Transaction) => void;
	onSplitTransaction?: (transaction: Transaction) => void;
	onCreateRule?: (transaction: Transaction) => void;
}

export function TransactionList({
	accountId,
	searchQuery,
	filters,
	onCreate,
	onDeleteMany,
	onEditTransaction,
	onDeleteTransaction,
	onSplitTransaction,
	onCreateRule,
}: TransactionListProps) {
	const {
		transactions,
		isLoading,
		isLoadingMore,
		error,
		hasMore,
		loadMore,
		updateTransaction,
	} = useTransactionsQuery({ accountId, searchQuery, filters });
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const { getAccountDisplayName } = useAccounts();
	const { categoryMap } = useCategories();
	const sentinelRef = useRef<HTMLDivElement>(null);

	// splits whose source is also in the list render under it, not as rows
	const { splitMap, topLevel } = useMemo(() => {
		const ids = new Set(transactions.map((t) => t.id.toString()));
		const map = new Map<string, Transaction[]>();
		for (const tx of transactions) {
			if (tx.splitFromId && ids.has(tx.splitFromId.toString())) {
				const key = tx.splitFromId.toString();
				map.set(key, [...(map.get(key) ?? []), tx]);
			}
		}
		return {
			splitMap: map,
			topLevel: transactions.filter(
				(tx) => !tx.splitFromId || !ids.has(tx.splitFromId.toString()),
			),
		};
	}, [transactions]);

	const { isSelected, toggleSelection, toggleItems, clearSelection } =
		useMultiSelect({ items: topLevel, getId: (t) => t.id });

	const enrich = useCallback(
		(tx: Transaction) => {
			if (tx.categoryId && !tx.category) {
				const category = categoryMap.get(tx.categoryId.toString());
				if (category) return { ...tx, category };
			}
			return tx;
		},
		[categoryMap],
	);

	const selected = useMemo(
		() => topLevel.filter((t) => isSelected(t.id)),
		[topLevel, isSelected],
	);

	useEffect(() => {
		const el = sentinelRef.current;
		if (!el || !hasMore || isLoadingMore) return;
		const io = new IntersectionObserver(
			([entry]) => entry.isIntersecting && loadMore(),
			{ rootMargin: "600px 0px" },
		);
		io.observe(el);
		return () => io.disconnect();
	}, [hasMore, isLoadingMore, loadMore]);

	if (isLoading) {
		return (
			<div className="space-y-6">
				{[3, 4, 2].map((rows, g) => (
					<div key={g}>
						<Skeleton className="mb-2 h-4 w-24" />
						<div className="divide-y">
							{Array.from({ length: rows }, (_, i) => (
								<div key={i} className="flex items-center justify-between py-3">
									<div className="space-y-2">
										<Skeleton className="h-4 w-48" />
										<Skeleton className="h-3 w-32" />
									</div>
									<div className="flex flex-col items-end space-y-2">
										<Skeleton className="h-4 w-20" />
										<Skeleton className="h-3 w-10" />
									</div>
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		);
	}

	if (error) {
		return (
			<p className="py-8 text-sm text-destructive">
				Couldn't load transactions: {String(error)}
			</p>
		);
	}

	const groups = groupTransactionsByDay(topLevel);

	if (groups.length === 0) {
		const filtered =
			!!searchQuery ||
			Object.values(filters ?? {}).some((v) =>
				Array.isArray(v) ? v.length > 0 : v !== undefined,
			);
		return (
			<EmptyState
				text={filtered ? "No transactions match." : "No transactions yet."}
				action={onCreate && "Add transaction"}
				onAction={onCreate}
			/>
		);
	}

	let offset = 0;

	return (
		<div data-selecting={selected.length > 0 || undefined}>
			{selected.length > 0 && (
				<SelectionBar
					transactions={selected}
					onClear={clearSelection}
					onDelete={
						onDeleteMany
							? async () => {
									await onDeleteMany(selected);
									clearSelection();
								}
							: undefined
					}
				/>
			)}

			<div className="space-y-6">
				{groups.map((group) => {
					const start = offset;
					offset += group.transactions.length;
					return (
						<ListGroup
							key={group.date}
							title={group.displayDate}
							onClick={(e) => {
								if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return;
								e.preventDefault();
								toggleItems(group.transactions.map((t) => t.id));
							}}
						>
							{group.transactions.map((tx, i) => (
								<TransactionItem
									key={tx.id.toString()}
									transaction={enrich(tx)}
									isSelected={isSelected(tx.id)}
									onSelect={toggleSelection}
									globalIndex={start + i}
									expanded={expandedId === tx.id.toString()}
									onToggle={() =>
										setExpandedId((cur) =>
											cur === tx.id.toString() ? null : tx.id.toString(),
										)
									}
									onSetCategory={(c) =>
										updateTransaction({
											id: tx.id,
											categoryId: c?.id ?? null,
										})
									}
									getAccountDisplayName={getAccountDisplayName}
									onEdit={onEditTransaction}
									onDelete={onDeleteTransaction}
									onSplit={onSplitTransaction}
									onCreateRule={onCreateRule}
									inlineSplits={splitMap.get(tx.id.toString())}
								/>
							))}
						</ListGroup>
					);
				})}
			</div>

			{hasMore && <div ref={sentinelRef} className="h-px" />}
			{isLoadingMore && (
				<p className="py-6 text-center text-sm text-muted-foreground">
					Loading more…
				</p>
			)}
		</div>
	);
}
