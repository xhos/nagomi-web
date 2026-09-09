"use client";

import {
	BookmarkPlus,
	Copy,
	Edit,
	FileText,
	ReceiptText,
	Split,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { ReceiptDetailDialog } from "@/app/receipts/components/ReceiptDetailDialog";
import { Amount, Card, HStack, Muted, VStack } from "@/components/lib";
import { Badge } from "@/components/ui/badge";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useReceipt } from "@/hooks/useReceipts";
import { getCategoryTextColor } from "@/lib/color-utils";
import { cn } from "@/lib/utils";
import { getCategoryDisplayName } from "@/lib/utils/category";
import {
	formatAmount,
	formatCurrency,
	formatTime,
	getCategorizationStatus,
	getDirectionDisplay,
	getMerchantStatus,
} from "@/lib/utils/transaction";

interface TransactionItemProps {
	transaction: Transaction;
	isSelected: boolean;
	onSelect: (id: bigint, index: number, event: React.MouseEvent) => void;
	globalIndex: number;
	getAccountDisplayName: (accountId: bigint, accountName?: string) => string;
	onEdit?: (transaction: Transaction) => void;
	onDelete?: (transaction: Transaction) => void;
	onViewDetails?: (transaction: Transaction) => void;
	onSplit?: (transaction: Transaction) => void;
	onCreateRule?: (transaction: Transaction) => void;
	inlineSplits?: Transaction[];
}

export function TransactionItem({
	transaction,
	isSelected,
	onSelect,
	globalIndex,
	getAccountDisplayName,
	onEdit,
	onDelete,
	onViewDetails,
	onSplit,
	onCreateRule,
	inlineSplits,
}: TransactionItemProps) {
	const handleClick = (event: React.MouseEvent) => {
		if (event.ctrlKey || event.metaKey || event.shiftKey) {
			event.preventDefault();
			onSelect(transaction.id, globalIndex, event);
		}
	};

	const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
	const { data: receiptData, isLoading: isReceiptLoading } = useReceipt(
		receiptDialogOpen && transaction.receiptId ? transaction.receiptId : null,
	);

	const handleCopyMerchant = () => {
		const merchantName = transaction.merchant || transaction.description || "";
		navigator.clipboard.writeText(merchantName);
	};

	const directionInfo = getDirectionDisplay(transaction.direction);
	const categoryInfo = getCategorizationStatus(transaction);
	const merchantInfo = getMerchantStatus(transaction);
	const amount = formatAmount(transaction.txAmount);
	const _formattedAmount = formatCurrency(
		amount,
		transaction.txAmount?.currencyCode,
	);

	const hasSplits = inlineSplits && inlineSplits.length > 0;

	return (
		<div className="relative">
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<Card
						variant="default"
						padding="sm"
						interactive
						onClick={handleClick}
						className={cn(isSelected && "ring-1 ring-primary")}
					>
						<HStack spacing="xl" justify="between">
							{/* Left: Description & Category */}
							<VStack spacing="sm" align="start" className="flex-1 min-w-0">
								<div className="text-sm font-semibold truncate">
									{transaction.description ||
										transaction.merchant ||
										"Unknown transaction"}
								</div>

								<HStack spacing="sm" align="center" className="flex-wrap gap-2">
									{transaction.merchant &&
										transaction.description !== transaction.merchant && (
											<>
												<TooltipProvider>
													<Tooltip>
														<TooltipTrigger asChild>
															<Muted size="xs" className="truncate cursor-help">
																{transaction.merchant}
															</Muted>
														</TooltipTrigger>
														<TooltipContent>
															<p>{merchantInfo.text}</p>
														</TooltipContent>
													</Tooltip>
												</TooltipProvider>
												<Muted size="xs">•</Muted>
											</>
										)}

									{transaction.category?.slug && (
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<Badge
														variant="outline"
														className="text-xs border-0 cursor-help"
														style={{
															backgroundColor: transaction.category.color,
															color: getCategoryTextColor(
																transaction.category.slug,
															),
														}}
													>
														{getCategoryDisplayName(transaction.category.slug)}
													</Badge>
												</TooltipTrigger>
												<TooltipContent>
													<p>{categoryInfo.text}</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									)}
								</HStack>
							</VStack>

							{/* Right: Amount & Account/Time */}
							<VStack spacing="sm" align="end" className="shrink-0">
								{transaction.foreignAmount ? (
									<VStack spacing="xs" align="end">
										<Amount
											value={formatAmount(transaction.foreignAmount)}
											currency={transaction.foreignAmount.currencyCode}
											variant={
												directionInfo.label === "in" ? "positive" : "negative"
											}
											className="text-lg"
										/>
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<Muted size="xs" className="font-mono cursor-help">
														{formatCurrency(
															amount,
															transaction.txAmount?.currencyCode,
														)}
													</Muted>
												</TooltipTrigger>
												<TooltipContent>
													<p>rate: {transaction.exchangeRate}</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</VStack>
								) : (
									<Amount
										value={amount}
										currency={transaction.txAmount?.currencyCode}
										variant={
											directionInfo.label === "in" ? "positive" : "negative"
										}
										className="text-lg"
									/>
								)}

								<VStack spacing="xs" align="end">
									{transaction.accountId && (
										<Muted size="xs">
											{getAccountDisplayName(
												transaction.accountId,
												transaction.accountName,
											)}
										</Muted>
									)}
									<HStack spacing="sm" align="center">
										{transaction.receiptId && (
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<button
															onClick={(e) => {
																e.stopPropagation();
																setReceiptDialogOpen(true);
															}}
															className="text-emerald-500 hover:text-emerald-400 transition-colors duration-150"
														>
															<ReceiptText className="h-3.5 w-3.5" />
														</button>
													</TooltipTrigger>
													<TooltipContent>
														<p>receipt verified</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										)}
										<Muted size="xs">{formatTime(transaction.txDate)}</Muted>
									</HStack>
								</VStack>
							</VStack>
						</HStack>

						{/* Inline splits */}
						{hasSplits && (
							<div className="mt-3 pt-2.5 border-t border-border/60 space-y-1.5">
								{inlineSplits.map((split) => {
									const splitAmount = formatCurrency(
										formatAmount(split.txAmount),
										split.txAmount?.currencyCode,
									);
									return (
										<HStack
											key={split.id.toString()}
											justify="between"
											align="center"
										>
											<Muted size="xs">
												{getAccountDisplayName(
													split.accountId,
													split.accountName,
												)}
											</Muted>
											<HStack spacing="sm" align="center">
												{split.forgiven && (
													<span className="text-[10px] text-muted-foreground/50 italic">
														forgiven
													</span>
												)}
												<Muted
													size="xs"
													className={cn(
														"font-mono",
														split.forgiven && "line-through opacity-40",
													)}
												>
													{splitAmount}
												</Muted>
											</HStack>
										</HStack>
									);
								})}
							</div>
						)}
					</Card>
				</ContextMenuTrigger>

				<ContextMenuContent>
					{onViewDetails && (
						<ContextMenuItem onClick={() => onViewDetails(transaction)}>
							<FileText className="mr-2 h-4 w-4" />
							Details
						</ContextMenuItem>
					)}
					{onEdit && (
						<ContextMenuItem onClick={() => onEdit(transaction)}>
							<Edit className="mr-2 h-4 w-4" />
							Edit
						</ContextMenuItem>
					)}
					{onSplit && (
						<ContextMenuItem onClick={() => onSplit(transaction)}>
							<Split className="mr-2 h-4 w-4" />
							{hasSplits ? "Re-split" : "Split"}
						</ContextMenuItem>
					)}
					{transaction.receiptId && (
						<ContextMenuItem onClick={() => setReceiptDialogOpen(true)}>
							<ReceiptText className="mr-2 h-4 w-4" />
							View Receipt
						</ContextMenuItem>
					)}
					<ContextMenuItem onClick={handleCopyMerchant}>
						<Copy className="mr-2 h-4 w-4" />
						Copy Name
					</ContextMenuItem>
					{onCreateRule && (
						<ContextMenuItem onClick={() => onCreateRule(transaction)}>
							<BookmarkPlus className="mr-2 h-4 w-4" />
							Create Rule
						</ContextMenuItem>
					)}
					{onDelete && (
						<ContextMenuItem
							onClick={() => onDelete(transaction)}
							className="text-destructive"
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</ContextMenuItem>
					)}
				</ContextMenuContent>
			</ContextMenu>

			{transaction.receiptId && (
				<ReceiptDetailDialog
					receipt={receiptData?.receipt ?? null}
					linkCandidates={receiptData?.linkCandidates}
					open={receiptDialogOpen}
					onOpenChange={setReceiptDialogOpen}
					isLoading={isReceiptLoading}
				/>
			)}
		</div>
	);
}
