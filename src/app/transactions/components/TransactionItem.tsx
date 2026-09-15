"use client";

import {
	BookmarkPlus,
	Check,
	Copy,
	Ellipsis,
	FileText,
	Pencil,
	ReceiptText,
	Split,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { ReceiptDetailDialog } from "@/app/receipts/components/ReceiptDetailDialog";
import { Amount } from "@/components/ui/amount";
import { CategoryPicker } from "@/components/ui/category-picker";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ListRow, RowMenuButton } from "@/components/ui/list";
import type { Category } from "@/gen/nagomi/v1/category_pb";
import { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useReceipt } from "@/hooks/useReceipts";
import { cn } from "@/lib/utils";
import { getCategoryDisplayName } from "@/lib/utils/category";
import { formatAmount, formatTime } from "@/lib/utils/transaction";
import { TransactionDetails } from "./TransactionDetails";

interface TransactionItemProps {
	transaction: Transaction;
	isSelected: boolean;
	onSelect: (id: bigint, index: number, event: React.MouseEvent) => void;
	globalIndex: number;
	expanded: boolean;
	onToggle: () => void;
	onSetCategory: (category: Category | null) => void;
	getAccountDisplayName: (accountId: bigint, accountName?: string) => string;
	onEdit?: (transaction: Transaction) => void;
	onDelete?: (transaction: Transaction) => void;
	onSplit?: (transaction: Transaction) => void;
	onCreateRule?: (transaction: Transaction) => void;
	inlineSplits?: Transaction[];
}

export function TransactionItem({
	transaction,
	isSelected,
	onSelect,
	globalIndex,
	expanded,
	onToggle,
	onSetCategory,
	getAccountDisplayName,
	onEdit,
	onDelete,
	onSplit,
	onCreateRule,
	inlineSplits,
}: TransactionItemProps) {
	const [receiptOpen, setReceiptOpen] = useState(false);
	const { data: receiptData, isLoading: isReceiptLoading } = useReceipt(
		receiptOpen && transaction.receiptId ? transaction.receiptId : null,
	);

	const tone =
		transaction.direction === TransactionDirection.DIRECTION_INCOMING
			? "in"
			: "out";
	const amount = formatAmount(transaction.txAmount);
	const currency = transaction.txAmount?.currencyCode;
	const title =
		transaction.description || transaction.merchant || "Unknown transaction";
	const showMerchant =
		transaction.merchant && transaction.merchant !== transaction.description;
	const hasSplits = !!inlineSplits?.length;

	const handleRowClick = (event: React.MouseEvent) => {
		if (event.ctrlKey || event.metaKey || event.shiftKey) {
			event.preventDefault();
			onSelect(transaction.id, globalIndex, event);
			return;
		}
		onToggle();
	};

	const handleCheck = (event: React.MouseEvent) => {
		event.stopPropagation();
		onSelect(
			transaction.id,
			globalIndex,
			event.shiftKey ? event : ({ ctrlKey: true } as React.MouseEvent),
		);
	};

	const copyName = () =>
		navigator.clipboard.writeText(transaction.merchant || title);

	// same items for right-click and the hover menu
	const actions = (
		Item: typeof ContextMenuItem,
		Separator: typeof ContextMenuSeparator,
	) => (
		<>
			<Item onClick={onToggle}>
				<FileText /> {expanded ? "Collapse" : "Details"}
			</Item>
			{onEdit && (
				<Item onClick={() => onEdit(transaction)}>
					<Pencil /> Edit
				</Item>
			)}
			{onSplit && (
				<Item onClick={() => onSplit(transaction)}>
					<Split /> {hasSplits ? "Re-split" : "Split"}
				</Item>
			)}
			{transaction.receiptId && (
				<Item onClick={() => setReceiptOpen(true)}>
					<ReceiptText /> View receipt
				</Item>
			)}
			{onCreateRule && (
				<Item onClick={() => onCreateRule(transaction)}>
					<BookmarkPlus /> Create rule
				</Item>
			)}
			<Item onClick={copyName}>
				<Copy /> Copy name
			</Item>
			{onDelete && (
				<>
					<Separator />
					<Item variant="destructive" onClick={() => onDelete(transaction)}>
						<Trash2 /> Delete
					</Item>
				</>
			)}
		</>
	);

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<ListRow
						selected={isSelected}
						expanded={expanded}
						onClick={handleRowClick}
					>
						<div className="flex items-start gap-3">
							<span className="relative mt-1 flex size-4 shrink-0 items-center justify-center">
								<input
									type="checkbox"
									aria-label="Select transaction"
									checked={isSelected}
									onChange={() => {}}
									onClick={handleCheck}
									className={cn(
										"peer size-4 cursor-pointer appearance-none rounded-md border transition-opacity",
										"opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [[data-selecting]_&]:opacity-100",
										"border-input bg-background checked:border-accent checked:bg-accent checked:opacity-100",
									)}
								/>
								<Check
									className="pointer-events-none absolute size-3 text-accent-foreground opacity-0 peer-checked:opacity-100"
									strokeWidth={3}
								/>
							</span>

							<div className="min-w-0 flex-1">
								<div className="truncate font-medium">{title}</div>
								<div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
									{showMerchant && (
										<span className="truncate">{transaction.merchant}</span>
									)}
									{showMerchant && <span aria-hidden>·</span>}
									<CategoryPicker
										value={transaction.categoryId}
										onChange={onSetCategory}
									>
										<button
											type="button"
											onClick={(e) => e.stopPropagation()}
											title="Change category"
											className="-mx-1 flex shrink-0 items-center gap-1.5 rounded-md px-1 hover:bg-muted hover:text-foreground"
										>
											{transaction.category ? (
												<>
													<span
														className="size-2 rounded-full"
														style={{
															backgroundColor: transaction.category.color,
														}}
													/>
													{getCategoryDisplayName(transaction.category.slug)}
												</>
											) : (
												<>
													<span className="size-2 rounded-full border border-dashed border-current" />
													Uncategorized
												</>
											)}
										</button>
									</CategoryPicker>
									{transaction.accountId && (
										<>
											<span aria-hidden>·</span>
											<span className="truncate">
												{getAccountDisplayName(
													transaction.accountId,
													transaction.accountName,
												)}
											</span>
										</>
									)}
									{transaction.receiptId && (
										<button
											type="button"
											aria-label="View receipt"
											onClick={(e) => {
												e.stopPropagation();
												setReceiptOpen(true);
											}}
											className="shrink-0 hover:text-foreground"
										>
											<ReceiptText className="size-3.5" />
										</button>
									)}
								</div>

								{hasSplits && !expanded && (
									<div className="mt-2 space-y-1 border-l-2 border-border pl-3 text-sm text-muted-foreground">
										{inlineSplits?.map((split) => (
											<div
												key={split.id.toString()}
												className="flex items-center justify-between gap-3"
											>
												<span className="truncate">
													{getAccountDisplayName(
														split.accountId,
														split.accountName,
													)}
													{split.forgiven && " · forgiven"}
												</span>
												<Amount
													value={formatAmount(split.txAmount)}
													currency={split.txAmount?.currencyCode}
													tone="out"
													className={cn(split.forgiven && "line-through")}
												/>
											</div>
										))}
									</div>
								)}
							</div>

							<div className="shrink-0 text-right">
								{transaction.foreignAmount ? (
									<>
										<Amount
											value={formatAmount(transaction.foreignAmount)}
											currency={transaction.foreignAmount.currencyCode}
											tone={tone}
											className="block font-medium"
										/>
										<span
											className="block text-sm text-muted-foreground"
											title={`rate ${transaction.exchangeRate}`}
										>
											<Amount value={amount} currency={currency} tone="out" />
										</span>
									</>
								) : (
									<Amount
										value={amount}
										currency={currency}
										tone={tone}
										className="block font-medium"
									/>
								)}
								<span className="block text-sm text-muted-foreground">
									{formatTime(transaction.txDate)}
								</span>
							</div>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<RowMenuButton
										aria-label="Actions"
										onClick={(e) => e.stopPropagation()}
									>
										<Ellipsis className="size-4" />
									</RowMenuButton>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									onClick={(e) => e.stopPropagation()}
								>
									{actions(DropdownMenuItem, DropdownMenuSeparator)}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>

						{expanded && (
							<div className="pl-7" onClick={(e) => e.stopPropagation()}>
								<TransactionDetails
									transaction={transaction}
									getAccountDisplayName={getAccountDisplayName}
									onEdit={onEdit && (() => onEdit(transaction))}
									onSplit={onSplit && (() => onSplit(transaction))}
									onCreateRule={
										onCreateRule && (() => onCreateRule(transaction))
									}
									onViewReceipt={
										transaction.receiptId
											? () => setReceiptOpen(true)
											: undefined
									}
									onDelete={onDelete && (() => onDelete(transaction))}
								/>
							</div>
						)}
					</ListRow>
				</ContextMenuTrigger>
				<ContextMenuContent>
					{actions(ContextMenuItem, ContextMenuSeparator)}
				</ContextMenuContent>
			</ContextMenu>

			{transaction.receiptId && (
				<ReceiptDetailDialog
					receipt={receiptData?.receipt ?? null}
					linkCandidates={receiptData?.linkCandidates}
					open={receiptOpen}
					onOpenChange={setReceiptOpen}
					isLoading={isReceiptLoading}
				/>
			)}
		</>
	);
}
