"use client";

import { AlertCircle } from "lucide-react";
import * as React from "react";
import { HStack, Text, VStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Category } from "@/gen/nagomi/v1/category_pb";

interface DeleteDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	category: Category | null;
	childCount: number;
	onConfirm: () => Promise<void>;
}

export function DeleteDialog({
	open,
	onOpenChange,
	category,
	childCount,
	onConfirm,
}: DeleteDialogProps) {
	const [isLoading, setIsLoading] = React.useState(false);

	const handleConfirm = async () => {
		setIsLoading(true);
		try {
			await onConfirm();
			onOpenChange(false);
		} catch (error) {
			console.error("Failed to delete category:", error);
		} finally {
			setIsLoading(false);
		}
	};

	if (!category) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<AlertCircle className="h-5 w-5 text-destructive" />
						delete category
					</DialogTitle>
				</DialogHeader>
				<VStack spacing="sm" className="py-4">
					<div className="bg-muted rounded p-3">
						<span className="font-medium font-mono">{category.slug}</span>
					</div>
					{childCount > 0 && (
						<div className="bg-destructive/10 border border-destructive/20 rounded p-3">
							<Text size="sm" weight="medium" color="destructive">
								This will also delete {childCount} child categor
								{childCount === 1 ? "y" : "ies"}.
							</Text>
						</div>
					)}
				</VStack>
				<DialogFooter>
					<HStack spacing="sm" justify="end" className="w-full">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isLoading}
						>
							cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={handleConfirm}
							disabled={isLoading}
						>
							{isLoading ? "deleting..." : "delete category"}
						</Button>
					</HStack>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
