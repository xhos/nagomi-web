"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ImportPickerDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onFiles: (files: File[]) => void;
}

export function ImportPickerDialog({
	open,
	onOpenChange,
	onFiles,
}: ImportPickerDialogProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>import</DialogTitle>
				</DialogHeader>
				<button
					type="button"
					onDrop={(e) => {
						e.preventDefault();
						setDragging(false);
						onFiles(Array.from(e.dataTransfer.files));
					}}
					onDragOver={(e) => e.preventDefault()}
					onDragEnter={() => setDragging(true)}
					onDragLeave={(e) => {
						if (!e.currentTarget.contains(e.relatedTarget as Node | null))
							setDragging(false);
					}}
					onClick={() => fileInputRef.current?.click()}
					className={cn(
						"w-full rounded-md border border-dashed p-6 text-center transition-colors hover:bg-muted/60",
						dragging && "border-primary bg-muted/60",
					)}
				>
					<Upload className="mx-auto mb-2 size-4 text-muted-foreground" />
					<p className="text-sm">
						Drop PDF statements or a CSV export, or click to choose
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						RBC statements, or recent transactions from online banking
					</p>
					<input
						ref={fileInputRef}
						type="file"
						accept="application/pdf,.pdf,text/csv,.csv"
						multiple
						onChange={(e) => {
							onFiles(Array.from(e.target.files ?? []));
							e.target.value = "";
						}}
						className="hidden"
					/>
				</button>
			</DialogContent>
		</Dialog>
	);
}
