"use client";

import { Code, ConnectError } from "@connectrpc/connect";
import { FileImage, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { FormError } from "@/components/ui/forms";
import { useUser } from "@/hooks/useReceipts";
import { receiptsApi } from "@/lib/api/receipts";

interface UploadReceiptDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onUploadComplete: () => void;
	onDuplicate?: (existingReceiptId: bigint) => void;
}

function parseDuplicateReceiptId(message: string): bigint | null {
	const match = message.match(/\(id (\d+)\)/);
	return match ? BigInt(match[1]) : null;
}

export function UploadReceiptDialog({
	open,
	onOpenChange,
	onUploadComplete,
	onDuplicate,
}: UploadReceiptDialogProps) {
	const { user } = useUser();
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [duplicateReceiptId, setDuplicateReceiptId] = useState<bigint | null>(
		null,
	);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const validateAndSetFile = useCallback((file: File) => {
		const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
		if (!validTypes.includes(file.type)) {
			setError("Use a JPEG, PNG, WebP, or HEIC image.");
			return;
		}

		const maxSizeBytes = 16 * 1024 * 1024;
		if (file.size > maxSizeBytes) {
			setError("Images must be under 16MB.");
			return;
		}

		setError(null);
		setSelectedFile(file);
	}, []);

	useEffect(() => {
		if (!open) return;
		const handlePaste = (event: ClipboardEvent) => {
			const imageFile = Array.from(event.clipboardData?.files ?? []).find((f) =>
				f.type.startsWith("image/"),
			);
			if (imageFile) {
				event.preventDefault();
				validateAndSetFile(imageFile);
			}
		};
		document.addEventListener("paste", handlePaste);
		return () => document.removeEventListener("paste", handlePaste);
	}, [open, validateAndSetFile]);

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) validateAndSetFile(file);
	};

	const handleDrop = (event: React.DragEvent) => {
		event.preventDefault();
		const file = event.dataTransfer.files[0];
		if (file) validateAndSetFile(file);
	};

	const handleDragOver = (event: React.DragEvent) => {
		event.preventDefault();
	};

	const clearFile = () => {
		setSelectedFile(null);
		setError(null);
		setDuplicateReceiptId(null);
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const handleUpload = async () => {
		if (!selectedFile || !user?.id) return;

		setIsUploading(true);
		setError(null);

		try {
			const arrayBuffer = await selectedFile.arrayBuffer();
			await receiptsApi.upload({
				userId: user.id,
				imageData: new Uint8Array(arrayBuffer),
				contentType: selectedFile.type,
			});

			toast.success("Receipt uploaded", {
				description: "Reading it may take a moment.",
			});

			clearFile();
			onUploadComplete();
		} catch (err) {
			const connectError = ConnectError.from(err);
			const rawMessage = err instanceof Error ? err.message : "";
			const isAlreadyExists =
				connectError.code === Code.AlreadyExists ||
				rawMessage.includes("AlreadyExists");

			if (isAlreadyExists) {
				setDuplicateReceiptId(parseDuplicateReceiptId(rawMessage));
				setError(null);
			} else {
				setError("Couldn't upload receipt.");
			}
		} finally {
			setIsUploading(false);
		}
	};

	const handleClose = () => {
		if (!isUploading) {
			clearFile();
			onOpenChange(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>upload receipt</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					{!selectedFile ? (
						<button
							type="button"
							onDrop={handleDrop}
							onDragOver={handleDragOver}
							onClick={() => fileInputRef.current?.click()}
							className="w-full rounded-md border border-dashed p-8 text-center transition-colors hover:bg-muted/60"
						>
							<Upload className="mx-auto mb-3 size-6 text-muted-foreground" />
							<p className="text-sm">
								Drop an image, paste, or click to choose
							</p>
							<p className="mt-1 text-sm text-muted-foreground">
								JPEG, PNG, WebP, or HEIC up to 16MB
							</p>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/jpeg,image/png,image/webp,image/heic"
								onChange={handleFileSelect}
								className="hidden"
							/>
						</button>
					) : (
						<div className="flex items-center gap-3 rounded-md border p-3 text-sm">
							<FileImage className="size-4 shrink-0 text-muted-foreground" />
							<span className="flex-1 truncate">{selectedFile.name}</span>
							<span className="shrink-0 text-muted-foreground">
								{(selectedFile.size / 1024 / 1024).toFixed(1)} MB
							</span>
							<Button
								size="icon-sm"
								variant="ghost"
								aria-label="Remove file"
								onClick={clearFile}
								disabled={isUploading}
							>
								<X />
							</Button>
						</div>
					)}

					{duplicateReceiptId !== null && (
						<p className="text-sm">
							This receipt was already uploaded.{" "}
							{onDuplicate && (
								<button
									type="button"
									onClick={() => {
										onDuplicate(duplicateReceiptId);
										onOpenChange(false);
									}}
									className="underline underline-offset-2"
								>
									View it
								</button>
							)}
						</p>
					)}

					<FormError>{error}</FormError>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={handleClose}
						disabled={isUploading}
					>
						Cancel
					</Button>
					<Button
						onClick={handleUpload}
						disabled={!selectedFile || isUploading}
					>
						{isUploading ? "Uploading…" : "Upload"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
