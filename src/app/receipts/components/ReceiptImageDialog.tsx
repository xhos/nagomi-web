"use client";

import { useEffect, useState } from "react";
import { Muted } from "@/components/lib";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Receipt } from "@/gen/nagomi/v1/receipt_pb";
import { useReceipt } from "@/hooks/useReceipts";

interface ReceiptImageDialogProps {
	receipt: Receipt;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function mimeTypeFromPath(imagePath: string | undefined): string {
	const extension = imagePath?.split(".").pop()?.toLowerCase();
	const mimeTypes: Record<string, string> = {
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		png: "image/png",
		webp: "image/webp",
		heic: "image/heic",
	};
	return mimeTypes[extension ?? ""] ?? "image/jpeg";
}

export function ReceiptImageDialog({
	receipt,
	open,
	onOpenChange,
}: ReceiptImageDialogProps) {
	const [blobUrl, setBlobUrl] = useState<string | null>(null);

	const receiptQuery = useReceipt(open ? receipt.id : null);
	const imageData = receiptQuery.data?.imageData;

	useEffect(() => {
		if (!imageData || imageData.length === 0) return;

		const blob = new Blob([imageData as BlobPart], {
			type: mimeTypeFromPath(receipt.imagePath),
		});
		const url = URL.createObjectURL(blob);
		setBlobUrl(url);

		return () => {
			URL.revokeObjectURL(url);
			setBlobUrl(null);
		};
	}, [imageData, receipt.imagePath]);

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) setBlobUrl(null);
		onOpenChange(nextOpen);
	};

	const isLoading = receiptQuery.isLoading;
	const hasError =
		receiptQuery.isError || (!isLoading && !blobUrl && !!receiptQuery.data);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
				<DialogTitle className="sr-only">receipt image</DialogTitle>

				{hasError ? (
					<div className="p-12 text-center">
						<Muted size="sm">image not available</Muted>
					</div>
				) : isLoading || !blobUrl ? (
					<div className="p-12 text-center text-sm text-muted-foreground animate-pulse">
						loading...
					</div>
				) : (
					<img
						src={blobUrl}
						alt={receipt.merchant || "receipt"}
						className="w-full object-contain max-h-[80vh]"
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
