"use client";

import {
	Ellipsis,
	FileText,
	Image as ImageIcon,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
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
import type { Receipt } from "@/gen/nagomi/v1/receipt_pb";
import { ReceiptStatus } from "@/gen/nagomi/v1/receipt_pb";
import { useReceipt } from "@/hooks/useReceipts";
import { cn } from "@/lib/utils";
import { formatAmount } from "@/lib/utils/transaction";
import { ReceiptDetails, receiptDate, receiptStatus } from "./ReceiptDetails";
import { ReceiptImageDialog } from "./ReceiptImageDialog";

interface ReceiptRowProps {
	receipt: Receipt;
	expanded: boolean;
	onToggle: () => void;
	onRetry: () => void;
	onDelete: () => void;
}

export function ReceiptRow({
	receipt,
	expanded,
	onToggle,
	onRetry,
	onDelete,
}: ReceiptRowProps) {
	const [imageOpen, setImageOpen] = useState(false);
	const { data: detail } = useReceipt(expanded ? receipt.id : null);
	const full = detail?.receipt ?? receipt;
	const pending = receipt.status === ReceiptStatus.PENDING;
	const failed = receipt.status === ReceiptStatus.FAILED;
	const title =
		receipt.merchant ||
		(failed ? "Unreadable receipt" : pending ? "Processing…" : "Receipt");
	const meta = [
		receiptDate(receipt),
		receiptStatus(receipt.status),
		receipt.items.length
			? `${receipt.items.length} item${receipt.items.length === 1 ? "" : "s"}`
			: null,
	].filter(Boolean);

	const actions = (
		Item: typeof ContextMenuItem,
		Separator: typeof ContextMenuSeparator,
	) => (
		<>
			<Item onClick={onToggle}>
				<FileText /> {expanded ? "Collapse" : "Details"}
			</Item>
			{receipt.imagePath && (
				<Item onClick={() => setImageOpen(true)}>
					<ImageIcon /> View image
				</Item>
			)}
			{failed && (
				<Item onClick={onRetry}>
					<RefreshCw /> Retry parsing
				</Item>
			)}
			<Separator />
			<Item variant="destructive" onClick={onDelete}>
				<Trash2 /> Delete
			</Item>
		</>
	);

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<ListRow expanded={expanded} onClick={onToggle}>
						<div className="flex items-start gap-3">
							<div className="min-w-0 flex-1">
								<div
									className={cn(
										"truncate font-medium",
										(pending || failed) &&
											!receipt.merchant &&
											"font-normal text-muted-foreground",
									)}
								>
									{title}
								</div>
								<div
									className={cn(
										"truncate text-sm text-muted-foreground",
										failed && "text-destructive",
									)}
								>
									{meta.join(" · ")}
								</div>
							</div>
							{receipt.total && (
								<Amount
									value={formatAmount(receipt.total)}
									currency={receipt.total.currencyCode || receipt.currency}
									className="shrink-0 font-medium"
								/>
							)}
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
							<div
								className="mt-3 border-t pt-3"
								onClick={(e) => e.stopPropagation()}
							>
								<ReceiptDetails
									receipt={full}
									linkCandidates={detail?.linkCandidates}
									onViewImage={() => setImageOpen(true)}
									onRetry={onRetry}
									onDelete={onDelete}
								/>
							</div>
						)}
					</ListRow>
				</ContextMenuTrigger>
				<ContextMenuContent>
					{actions(ContextMenuItem, ContextMenuSeparator)}
				</ContextMenuContent>
			</ContextMenu>
			{imageOpen && (
				<ReceiptImageDialog
					receipt={receipt}
					open={imageOpen}
					onOpenChange={setImageOpen}
				/>
			)}
		</>
	);
}
