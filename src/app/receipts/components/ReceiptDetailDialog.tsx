"use client";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Receipt, ReceiptLinkCandidate } from "@/gen/nagomi/v1/receipt_pb";
import { ReceiptDetails } from "./ReceiptDetails";

interface ReceiptDetailDialogProps {
	receipt: Receipt | null;
	linkCandidates?: ReceiptLinkCandidate[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isLoading?: boolean;
}

// used where a receipt is opened from somewhere else (a transaction row, a duplicate upload)
export function ReceiptDetailDialog({
	receipt,
	linkCandidates,
	open,
	onOpenChange,
	isLoading,
}: ReceiptDetailDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{receipt?.merchant || "receipt"}</DialogTitle>
				</DialogHeader>
				{isLoading || !receipt ? (
					<p className="py-6 text-center text-sm text-muted-foreground">
						Loading…
					</p>
				) : (
					<ReceiptDetails
						receipt={receipt}
						linkCandidates={linkCandidates}
						onLinked={() => onOpenChange(false)}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
