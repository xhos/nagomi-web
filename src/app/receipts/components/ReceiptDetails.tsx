"use client";

import { format } from "date-fns";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/list";
import type { Receipt, ReceiptLinkCandidate } from "@/gen/nagomi/v1/receipt_pb";
import { ReceiptStatus } from "@/gen/nagomi/v1/receipt_pb";
import { useLinkReceipt } from "@/hooks/useReceipts";
import { formatAmount } from "@/lib/utils/transaction";

export const receiptDate = (r: Receipt) => {
	const d = r.bestDate ?? r.receiptDate;
	if (d?.year)
		return format(
			new Date(d.year, (d.month || 1) - 1, d.day || 1),
			"MMM d, yyyy",
		);
	return r.createdAt?.seconds
		? format(new Date(Number(r.createdAt.seconds) * 1000), "MMM d, yyyy")
		: null;
};

export const receiptStatus = (s: ReceiptStatus) =>
	s === ReceiptStatus.PENDING
		? "processing"
		: s === ReceiptStatus.PARSED
			? "parsed"
			: s === ReceiptStatus.LINKED
				? "linked"
				: s === ReceiptStatus.FAILED
					? "failed"
					: "unknown";

const stamp = (t?: { seconds?: bigint }) =>
	t?.seconds ? format(new Date(Number(t.seconds) * 1000), "MMM d, yyyy") : null;

interface ReceiptDetailsProps {
	receipt: Receipt;
	linkCandidates?: ReceiptLinkCandidate[];
	onLinked?: () => void;
	onViewImage?: () => void;
	onRetry?: () => void;
	onDelete?: () => void;
}

export function ReceiptDetails({
	receipt,
	linkCandidates = [],
	onLinked,
	onViewImage,
	onRetry,
	onDelete,
}: ReceiptDetailsProps) {
	const { mutate: link, isPending: linking } = useLinkReceipt();
	const currency = receipt.total?.currencyCode || receipt.currency || "USD";
	const money = (m?: {
		units?: bigint;
		nanos?: number;
		currencyCode?: string;
	}) =>
		m ? (
			<Amount value={formatAmount(m)} currency={m.currencyCode || currency} />
		) : (
			"—"
		);
	const canLink =
		receipt.status === ReceiptStatus.PARSED && !receipt.transactionId;

	return (
		<div className="space-y-4 text-sm">
			{receipt.items.length > 0 && (
				<div className="divide-y">
					{receipt.items.map((item) => (
						<div key={item.id} className="flex justify-between gap-4 py-1">
							<span className="truncate">
								{item.quantity !== 1 && (
									<span className="text-muted-foreground">
										{item.quantity}×{" "}
									</span>
								)}
								{item.name || item.rawName}
							</span>
							<span className="shrink-0 tabular-nums text-muted-foreground">
								{money(item.unitPrice)}
							</span>
						</div>
					))}
				</div>
			)}

			<div>
				{receipt.subtotal && (
					<DetailRow label="Subtotal">{money(receipt.subtotal)}</DetailRow>
				)}
				{receipt.tax && <DetailRow label="Tax">{money(receipt.tax)}</DetailRow>}
				<DetailRow label="Total">
					<span className="font-medium">{money(receipt.total)}</span>
				</DetailRow>
				<DetailRow label="Date">
					{receiptDate(receipt) ?? "—"}
					{receipt.imageTakenAt && (
						<span className="ml-2 text-muted-foreground">
							photo {stamp(receipt.imageTakenAt)}
						</span>
					)}
				</DetailRow>
				<DetailRow label="Status">
					{receiptStatus(receipt.status)}
					{receipt.confidence !== undefined &&
						receipt.status === ReceiptStatus.PARSED && (
							<span className="ml-2 text-muted-foreground">
								{Math.round(receipt.confidence * 100)}% confident
							</span>
						)}
				</DetailRow>
				{receipt.transactionId && (
					<DetailRow label="Transaction">
						{receipt.transactionMerchant || `#${receipt.transactionId}`}
						{receipt.transactionAmount && (
							<span className="ml-2 text-muted-foreground">
								{money(receipt.transactionAmount)}
							</span>
						)}
					</DetailRow>
				)}
			</div>

			{canLink && linkCandidates.length > 0 && (
				<div>
					<div className="border-b pb-1 font-medium">Link to a transaction</div>
					<div className="divide-y">
						{linkCandidates.map((c) => (
							<div
								key={c.transactionId.toString()}
								className="flex items-center gap-3 py-2"
							>
								<span className="min-w-0 flex-1">
									<span className="block truncate">{c.merchant}</span>
									<span className="block text-muted-foreground">
										{c.accountName} · {stamp(c.txDate)}
										{c.dateDiffDays !== 0 &&
											` (${c.dateDiffDays > 0 ? "+" : ""}${c.dateDiffDays}d)`}
									</span>
								</span>
								<span className="tabular-nums">{money(c.amount)}</span>
								<Button
									size="sm"
									variant="outline"
									disabled={linking}
									onClick={() =>
										link(
											{ receiptId: receipt.id, transactionId: c.transactionId },
											{ onSuccess: onLinked },
										)
									}
								>
									Link
								</Button>
							</div>
						))}
					</div>
				</div>
			)}

			{(onViewImage || onRetry || onDelete) && (
				<div className="flex flex-wrap gap-2">
					{onViewImage && receipt.imagePath && (
						<Button variant="outline" size="sm" onClick={onViewImage}>
							View image
						</Button>
					)}
					{onRetry && receipt.status === ReceiptStatus.FAILED && (
						<Button variant="outline" size="sm" onClick={onRetry}>
							Retry parsing
						</Button>
					)}
					{onDelete && (
						<Button
							variant="ghost"
							size="sm"
							className="ml-auto text-destructive hover:text-destructive"
							onClick={onDelete}
						>
							Delete
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
