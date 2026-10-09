"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, ListGroup } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import type { Category } from "@/gen/nagomi/v1/category_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useTransactionsQuery } from "@/hooks/useTransactionsQuery";
import { useRejectTransfer } from "@/hooks/useTransfers";
import { groupTransactionsByDay } from "@/lib/utils/transaction";
import { SelectionBar } from "./SelectionBar";
import type { TransactionFilters } from "./TransactionFiltersPanel";
import { TransactionItem } from "./TransactionItem";
import { TransferItem } from "./TransferItem";
import { TransferSuggestions } from "./TransferSuggestions";

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

function SkeletonGroups({ groups }: { groups: number[] }) {
	return (
		<div className="space-y-6">
			{groups.map((rows, g) => (
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
	const rejectTransfer = useRejectTransfer();
	const sentinelRef = useRef<HTMLDivElement>(null);

	// splits whose source is also in the list render under it, not as rows.
	// a transfer is one row, at whichever side the list reaches first, so a
	// later page never moves it
	const { splitMap, topLevel } = useMemo(() => {
		const ids = new Set(transactions.map((t) => t.id.toString()));
		const map = new Map<string, Transaction[]>();
		for (const tx of transactions) {
			if (tx.splitFromId && ids.has(tx.splitFromId.toString())) {
				const key = tx.splitFromId.toString();
				map.set(key, [...(map.get(key) ?? []), tx]);
			}
		}
		const shownTransfers = new Set<string>();
		return {
			splitMap: map,
			topLevel: transactions.filter((tx) => {
				if (tx.splitFromId && ids.has(tx.splitFromId.toString())) return false;
				if (!tx.transfer) return true;
				const key = tx.transfer.id.toString();
				if (shownTransfers.has(key)) return false;
				shownTransfers.add(key);
				return true;
			}),
		};
	}, [transactions]);

	const { isSelected, toggleSelection, toggleItems, clearSelection } =
		useMultiSelect({ items: topLevel, getId: (t) => t.id });

	// cache per transaction so memoized rows keep the same object across pages
	const enrich = useMemo(() => {
		const cache = new WeakMap<Transaction, Transaction>();
		return (tx: Transaction) => {
			if (!tx.categoryId || tx.category) return tx;
			const category = categoryMap.get(tx.categoryId.toString());
			if (!category) return tx;
			let enriched = cache.get(tx);
			if (!enriched) {
				enriched = { ...tx, category };
				cache.set(tx, enriched);
			}
			return enriched;
		};
	}, [categoryMap]);

	// the page passes fresh closures on every render; route them through a ref
	// so the row callbacks stay stable and loading a page re-renders only new rows
	const latest = useRef({
		toggleSelection,
		updateTransaction,
		unlinkTransfer: rejectTransfer.mutate,
		onEditTransaction,
		onDeleteTransaction,
		onSplitTransaction,
		onCreateRule,
	});
	latest.current = {
		toggleSelection,
		updateTransaction,
		unlinkTransfer: rejectTransfer.mutate,
		onEditTransaction,
		onDeleteTransaction,
		onSplitTransaction,
		onCreateRule,
	};
	const rowHandlers = useMemo(
		() => ({
			onSelect: (id: bigint, index: number, event: React.MouseEvent) =>
				latest.current.toggleSelection(id, index, event),
			onToggle: (id: bigint) =>
				setExpandedId((cur) => (cur === id.toString() ? null : id.toString())),
			onSetCategory: (id: bigint, c: Category | null) =>
				latest.current.updateTransaction({ id, categoryId: c?.id ?? null }),
			onEdit: (tx: Transaction) => latest.current.onEditTransaction?.(tx),
			onDelete: (tx: Transaction) => latest.current.onDeleteTransaction?.(tx),
			onSplit: (tx: Transaction) => latest.current.onSplitTransaction?.(tx),
			onCreateRule: (tx: Transaction) => latest.current.onCreateRule?.(tx),
			onUnlinkTransfer: (tx: Transaction) =>
				latest.current.unlinkTransfer({ transactionId: tx.id }),
		}),
		[],
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

		// fast scrolling outruns the fixed margin, so look ahead ~3s of travel
		let lastY = window.scrollY;
		let lastT = performance.now();
		const onScroll = () => {
			const now = performance.now();
			const y = window.scrollY;
			const velocity = Math.abs(y - lastY) / Math.max(now - lastT, 1);
			lastY = y;
			lastT = now;
			const lookahead = Math.min(velocity * 3000, 10000);
			if (el.getBoundingClientRect().top - window.innerHeight < lookahead) {
				loadMore();
			}
		};
		window.addEventListener("scroll", onScroll, { passive: true });

		return () => {
			io.disconnect();
			window.removeEventListener("scroll", onScroll);
		};
	}, [hasMore, isLoadingMore, loadMore]);

	if (isLoading) {
		return <SkeletonGroups groups={[3, 4, 2]} />;
	}

	if (error) {
		return (
			<p className="py-8 text-sm text-destructive">
				Couldn't load transactions: {String(error)}
			</p>
		);
	}

	const groups = groupTransactionsByDay(topLevel);

	const filtered =
		!!searchQuery ||
		Object.values(filters ?? {}).some((v) =>
			Array.isArray(v) ? v.length > 0 : v !== undefined,
		);

	if (groups.length === 0) {
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

			{!filtered && !accountId && <TransferSuggestions />}
			{rejectTransfer.error && (
				<p className="mb-4 text-sm text-destructive">
					{rejectTransfer.error.message}
				</p>
			)}

			<div className="space-y-6">
				{groups.map((group) => {
					const start = offset;
					offset += group.transactions.length;
					return (
						<ListGroup
							key={group.date}
							title={group.displayDate}
							// skip layout and paint for offscreen days; the padding keeps the row hover wash inside the clip
							className="-mx-3 px-3 [contain-intrinsic-size:auto_480px] [content-visibility:auto]"
							onClick={(e) => {
								if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return;
								e.preventDefault();
								toggleItems(group.transactions.map((t) => t.id));
							}}
						>
							{group.transactions.map((tx, i) =>
								tx.transfer ? (
									<TransferItem
										key={tx.id.toString()}
										transaction={tx}
										isSelected={isSelected(tx.id)}
										onSelect={rowHandlers.onSelect}
										globalIndex={start + i}
										expanded={expandedId === tx.id.toString()}
										onToggle={rowHandlers.onToggle}
										getAccountDisplayName={getAccountDisplayName}
										onUnlink={rowHandlers.onUnlinkTransfer}
									/>
								) : (
									<TransactionItem
										key={tx.id.toString()}
										transaction={enrich(tx)}
										isSelected={isSelected(tx.id)}
										onSelect={rowHandlers.onSelect}
										globalIndex={start + i}
										expanded={expandedId === tx.id.toString()}
										onToggle={rowHandlers.onToggle}
										onSetCategory={rowHandlers.onSetCategory}
										getAccountDisplayName={getAccountDisplayName}
										onEdit={onEditTransaction && rowHandlers.onEdit}
										onDelete={onDeleteTransaction && rowHandlers.onDelete}
										onSplit={onSplitTransaction && rowHandlers.onSplit}
										onCreateRule={onCreateRule && rowHandlers.onCreateRule}
										inlineSplits={splitMap.get(tx.id.toString())}
									/>
								),
							)}
						</ListGroup>
					);
				})}
			</div>

			{hasMore && <div ref={sentinelRef} className="h-px" />}
			{hasMore && (
				<div aria-busy={isLoadingMore} className="mt-6">
					<SkeletonGroups groups={[4]} />
				</div>
			)}
		</div>
	);
}
