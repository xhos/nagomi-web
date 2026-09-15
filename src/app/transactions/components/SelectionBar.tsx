"use client";

import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useTransactionAnalytics } from "@/hooks/useTransactionAnalytics";

interface SelectionBarProps {
	transactions: Transaction[];
	onClear: () => void;
	onDelete?: () => Promise<void>;
}

export function SelectionBar({
	transactions,
	onClear,
	onDelete,
}: SelectionBarProps) {
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const a = useTransactionAnalytics(transactions);
	const currency = transactions[0]?.txAmount?.currencyCode;
	const n = transactions.length;

	const handleDelete = async () => {
		if (!onDelete) return;
		setDeleting(true);
		try {
			await onDelete();
			setConfirmOpen(false);
		} finally {
			setDeleting(false);
		}
	};

	return (
		<div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-b bg-background py-2 text-sm">
			<span className="font-medium">{n} selected</span>
			<span className="flex gap-4 text-muted-foreground">
				<span>
					in <Amount value={a.totalIncome} currency={currency} tone="in" />
				</span>
				<span>
					out <Amount value={a.totalExpenses} currency={currency} tone="out" />
				</span>
				<span>
					net{" "}
					<Amount
						value={a.netAmount}
						currency={currency}
						className="text-foreground"
					/>
				</span>
			</span>
			<span className="ml-auto flex gap-2">
				{onDelete && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setConfirmOpen(true)}
					>
						Delete
					</Button>
				)}
				<Button variant="ghost" size="sm" onClick={onClear}>
					Clear
				</Button>
			</span>

			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {n} transaction{n === 1 ? "" : "s"}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This can't be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleDelete} disabled={deleting}>
							{deleting ? "Deleting…" : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
