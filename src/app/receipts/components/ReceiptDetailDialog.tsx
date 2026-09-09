"use client";

import { Link as LinkIcon } from "lucide-react";
import { Caption, HStack, Muted, VStack } from "@/components/lib";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Receipt, ReceiptLinkCandidate } from "@/gen/nagomi/v1/receipt_pb";
import { ReceiptStatus } from "@/gen/nagomi/v1/receipt_pb";
import { useLinkReceipt } from "@/hooks/useReceipts";
import { formatAmount, formatCurrency } from "@/lib/utils/transaction";

interface ReceiptDetailDialogProps {
	receipt: Receipt | null;
	linkCandidates?: ReceiptLinkCandidate[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isLoading?: boolean;
}

function formatReceiptDate(date?: {
	year: number;
	month?: number;
	day?: number;
}) {
	if (!date) return null;
	const month = String(date.month || 1).padStart(2, "0");
	const day = String(date.day || 1).padStart(2, "0");
	return `${day}.${month}.${date.year}`;
}

function formatTimestamp(ts?: { seconds?: bigint }) {
	if (!ts?.seconds) return null;
	return new Date(Number(ts.seconds) * 1000)
		.toLocaleDateString("en-GB", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		})
		.replace(/\//g, ".");
}

export function ReceiptDetailDialog({
	receipt,
	linkCandidates,
	open,
	onOpenChange,
	isLoading,
}: ReceiptDetailDialogProps) {
	const { mutate: linkReceipt, isPending: isLinking } = useLinkReceipt();

	if (!open) return null;

	const currency = receipt?.total?.currencyCode || receipt?.currency || "USD";

	const formatMoney = (amount?: {
		units?: string | bigint;
		nanos?: number;
		currencyCode?: string;
	}) => {
		if (!amount) return "—";
		const value = formatAmount(amount);
		return formatCurrency(value, amount.currencyCode || currency);
	};

	const items = receipt?.items || [];
	const confidence = receipt?.confidence
		? Math.round(receipt.confidence * 100)
		: null;
	const isParsedAndUnlinked =
		receipt?.status === ReceiptStatus.PARSED && !receipt?.transactionId;
	const candidates = isParsedAndUnlinked ? (linkCandidates ?? []) : [];

	const handleLink = (candidate: ReceiptLinkCandidate) => {
		if (!receipt) return;
		linkReceipt(
			{ receiptId: receipt.id, transactionId: candidate.transactionId },
			{ onSuccess: () => onOpenChange(false) },
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogTitle className="sr-only">receipt details</DialogTitle>

				{isLoading || !receipt ? (
					<div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
						loading...
					</div>
				) : (
					<VStack spacing="lg" className="w-full">
						<VStack spacing="xs" align="start">
							<div className="text-lg font-semibold">
								{receipt.merchant || "unknown merchant"}
							</div>
							{(receipt.bestDate ?? receipt.receiptDate) && (
								<Muted size="sm">
									{formatReceiptDate(receipt.bestDate ?? receipt.receiptDate)}
								</Muted>
							)}
							{receipt.bestDate && receipt.receiptDate && (
								<Muted size="xs">
									OCR date: {formatReceiptDate(receipt.receiptDate)}
								</Muted>
							)}
							{receipt.imageTakenAt && (
								<Muted size="xs">
									photo taken: {formatTimestamp(receipt.imageTakenAt)}
								</Muted>
							)}
						</VStack>

						{confidence !== null && (
							<HStack justify="between">
								<Caption>CONFIDENCE</Caption>
								<Muted size="xs" className="font-mono tabular-nums">
									{confidence}%
								</Muted>
							</HStack>
						)}

						{items.length > 0 && (
							<VStack spacing="sm" className="w-full">
								<Caption>ITEMS</Caption>
								<VStack spacing="xs" className="w-full">
									{items.map((item) => (
										<HStack key={item.id} justify="between" className="text-sm">
											<span className="truncate mr-4">
												{item.quantity !== 1 && (
													<span className="text-muted-foreground">
														{item.quantity}×{" "}
													</span>
												)}
												{item.name || item.rawName}
											</span>
											<span className="font-mono tabular-nums flex-shrink-0 text-muted-foreground">
												{formatMoney(item.unitPrice)}
											</span>
										</HStack>
									))}
								</VStack>
							</VStack>
						)}

						<VStack spacing="xs" className="w-full border-t border-border pt-4">
							{receipt.subtotal && (
								<HStack justify="between">
									<Muted size="sm">subtotal</Muted>
									<span className="font-mono text-sm tabular-nums text-muted-foreground">
										{formatMoney(receipt.subtotal)}
									</span>
								</HStack>
							)}
							{receipt.tax && (
								<HStack justify="between">
									<Muted size="sm">tax</Muted>
									<span className="font-mono text-sm tabular-nums text-muted-foreground">
										{formatMoney(receipt.tax)}
									</span>
								</HStack>
							)}
							<HStack justify="between" className="pt-1">
								<span className="text-sm font-semibold">total</span>
								<span className="font-mono font-semibold tabular-nums">
									{formatMoney(receipt.total)}
								</span>
							</HStack>
						</VStack>

						{receipt.transactionId ? (
							<HStack spacing="xs" className="text-xs text-muted-foreground">
								<LinkIcon className="h-3 w-3" />
								<span>
									linked to transaction #{receipt.transactionId.toString()}
								</span>
							</HStack>
						) : (
							candidates.length > 0 && (
								<VStack spacing="sm" className="w-full">
									<Caption>LINK TO TRANSACTION</Caption>
									<VStack spacing="xs" className="w-full">
										{candidates.map((candidate) => (
											<button
												key={candidate.transactionId.toString()}
												onClick={() => handleLink(candidate)}
												disabled={isLinking}
												className="w-full text-left rounded-md border border-border px-3 py-2 hover:border-primary/50 hover:bg-accent transition-colors duration-150 disabled:opacity-50"
											>
												<HStack justify="between" align="start">
													<VStack
														spacing="xs"
														align="start"
														className="flex-1 min-w-0"
													>
														<span className="text-sm font-medium truncate">
															{candidate.merchant}
														</span>
														<Muted size="xs">
															{candidate.accountName} ·{" "}
															{formatTimestamp(candidate.txDate)}
														</Muted>
													</VStack>
													<VStack
														spacing="xs"
														align="end"
														className="shrink-0 ml-3"
													>
														<span className="text-sm font-mono tabular-nums">
															{formatMoney(candidate.amount)}
														</span>
														{candidate.dateDiffDays !== 0 && (
															<Muted size="xs">
																{candidate.dateDiffDays > 0 ? "+" : ""}
																{candidate.dateDiffDays}d
															</Muted>
														)}
													</VStack>
												</HStack>
											</button>
										))}
									</VStack>
								</VStack>
							)
						)}
					</VStack>
				)}
			</DialogContent>
		</Dialog>
	);
}
