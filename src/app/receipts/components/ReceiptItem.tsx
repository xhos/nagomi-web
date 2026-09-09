"use client";

import type { Timestamp } from "@bufbuild/protobuf/wkt";
import {
	CheckCircle2,
	Clock,
	FileText,
	Image as ImageIcon,
	Link as LinkIcon,
	Loader2,
	RefreshCw,
	Trash2,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { Amount, HStack, VStack } from "@/components/lib";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Receipt } from "@/gen/nagomi/v1/receipt_pb";
import { ReceiptStatus } from "@/gen/nagomi/v1/receipt_pb";
import { useReceipt, useReceipts } from "@/hooks/useReceipts";
import { formatAmount, formatCurrency } from "@/lib/utils/transaction";
import { ReceiptDetailDialog } from "./ReceiptDetailDialog";
import { ReceiptImageDialog } from "./ReceiptImageDialog";

interface ReceiptItemProps {
	receipt: Receipt;
}

const statusConfig = {
	[ReceiptStatus.PENDING]: {
		label: "processing",
		className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
		icon: Loader2,
		animate: true,
	},
	[ReceiptStatus.PARSED]: {
		label: "parsed",
		className: "bg-blue-500/10 text-blue-600 border-blue-500/30",
		icon: CheckCircle2,
		animate: false,
	},
	[ReceiptStatus.LINKED]: {
		label: "linked",
		className: "bg-green-500/10 text-green-600 border-green-500/30",
		icon: LinkIcon,
		animate: false,
	},
	[ReceiptStatus.FAILED]: {
		label: "failed",
		className: "bg-red-500/10 text-red-600 border-red-500/30",
		icon: XCircle,
		animate: false,
	},
	[ReceiptStatus.UNSPECIFIED]: {
		label: "unknown",
		className: "bg-gray-500/10 text-gray-600 border-gray-500/30",
		icon: Clock,
		animate: false,
	},
};

function formatTimestampShort(ts?: Timestamp) {
	if (!ts?.seconds) return null;
	return new globalThis.Date(Number(ts.seconds) * 1000)
		.toLocaleDateString("en-GB", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		})
		.replace(/\//g, ".");
}

function formatMoney(
	amount?: { units?: string | bigint; nanos?: number; currencyCode?: string },
	fallbackCurrency?: string,
) {
	if (!amount) return null;
	const value = formatAmount(amount);
	return formatCurrency(
		value,
		amount.currencyCode || fallbackCurrency || "USD",
	);
}

export function ReceiptItem({ receipt }: ReceiptItemProps) {
	const [selectedReceiptId, setSelectedReceiptId] = useState<bigint | null>(
		null,
	);
	const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
	const { deleteReceipt, isDeleting, retryParse, isRetrying } = useReceipts();
	const { data: receiptDetail, isLoading: isLoadingDetail } =
		useReceipt(selectedReceiptId);

	const status = statusConfig[receipt.status];
	const StatusIcon = status.icon;
	const isFailed = receipt.status === ReceiptStatus.FAILED;
	const isViewable =
		receipt.status === ReceiptStatus.PARSED ||
		receipt.status === ReceiptStatus.LINKED;
	const formattedDate = formatTimestampShort(receipt.createdAt);
	const currency = receipt.total?.currencyCode || receipt.currency;
	const hasItems = receipt.items && receipt.items.length > 0 && isViewable;
	const visibleItems = hasItems ? receipt.items : [];

	const handleDelete = () => {
		deleteReceipt(receipt.id);
	};

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<Card
						className={`p-4 hover:border-primary/50 transition-colors duration-150 ${isViewable ? "cursor-pointer" : ""}`}
						onClick={() => {
							if (isViewable) setSelectedReceiptId(receipt.id);
						}}
					>
						<VStack spacing="sm" className="w-full">
							{/* Header: merchant + date */}
							<HStack justify="between" align="start" className="w-full">
								<div className="text-sm font-semibold leading-snug flex-1 min-w-0 mr-2">
									{receipt.merchant ||
										(isFailed ? (
											<span className="text-muted-foreground font-normal">
												unknown
											</span>
										) : (
											<span className="bg-gradient-to-r from-muted-foreground/40 via-muted-foreground to-muted-foreground/40 bg-[length:200%_100%] bg-clip-text text-transparent animate-[shimmer_2s_linear_infinite] font-normal">
												figuring it out...
											</span>
										))}
								</div>
								{formattedDate && (
									<span className="text-xs text-muted-foreground shrink-0 tabular-nums">
										{formattedDate}
									</span>
								)}
							</HStack>

							{/* Items list */}
							{hasItems && (
								<VStack spacing="xs" className="w-full pt-1">
									{visibleItems.map((item) => (
										<HStack key={item.id} justify="between" className="w-full">
											<span className="text-xs text-muted-foreground truncate mr-3 flex-1">
												{item.quantity !== 1 && <span>{item.quantity}× </span>}
												{item.name || item.rawName}
											</span>
											<span className="text-xs font-mono tabular-nums text-muted-foreground shrink-0">
												{formatMoney(item.unitPrice, currency) ?? "—"}
											</span>
										</HStack>
									))}
								</VStack>
							)}

							{/* Divider + total */}
							{receipt.total && (
								<div className="w-full border-t border-border pt-2 mt-1">
									<HStack justify="between" className="w-full">
										<span className="text-xs text-muted-foreground">total</span>
										<Amount
											value={formatAmount(receipt.total)}
											currency={receipt.total.currencyCode}
											className="text-sm font-semibold"
										/>
									</HStack>
								</div>
							)}

							{/* Footer: status badge + confidence */}
							<HStack justify="between" align="center" className="w-full">
								<Badge
									variant="outline"
									className={`${status.className} flex items-center gap-1 text-xs px-1.5 py-0`}
								>
									<StatusIcon
										className={`h-3 w-3 ${status.animate ? "animate-spin" : ""}`}
									/>
									{status.label}
								</Badge>
								{receipt.confidence &&
									receipt.status === ReceiptStatus.PARSED && (
										<span className="text-xs font-mono tabular-nums text-muted-foreground">
											{Math.round(receipt.confidence * 100)}%
										</span>
									)}
							</HStack>
						</VStack>
					</Card>
				</ContextMenuTrigger>

				<ContextMenuContent>
					{isViewable && (
						<ContextMenuItem onClick={() => setSelectedReceiptId(receipt.id)}>
							<FileText className="mr-2 h-4 w-4" />
							view details
						</ContextMenuItem>
					)}
					{receipt.imagePath && (
						<ContextMenuItem onClick={() => setIsImageDialogOpen(true)}>
							<ImageIcon className="mr-2 h-4 w-4" />
							view image
						</ContextMenuItem>
					)}
					{isFailed && (
						<ContextMenuItem
							onClick={() => retryParse(receipt.id)}
							disabled={isRetrying}
						>
							<RefreshCw className="mr-2 h-4 w-4" />
							retry parsing
						</ContextMenuItem>
					)}
					<ContextMenuItem
						onClick={handleDelete}
						disabled={isDeleting}
						className="text-destructive focus:text-destructive"
					>
						<Trash2 className="mr-2 h-4 w-4" />
						delete
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>

			<ReceiptDetailDialog
				receipt={receiptDetail?.receipt ?? null}
				linkCandidates={receiptDetail?.linkCandidates}
				open={selectedReceiptId !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedReceiptId(null);
				}}
				isLoading={isLoadingDetail}
			/>

			{isImageDialogOpen && (
				<ReceiptImageDialog
					receipt={receipt}
					open={isImageDialogOpen}
					onOpenChange={setIsImageDialogOpen}
				/>
			)}
		</>
	);
}
