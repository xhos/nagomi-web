"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/forms";
import { Input } from "@/components/ui/input";
import { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import { useTransactionsQuery } from "@/hooks/useTransactionsQuery";

interface RecordPaymentDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	friendAccountId: bigint;
	friendName: string;
	defaultAmount: string;
	defaultCurrency: string;
}

export function RecordPaymentDialog({
	open,
	onOpenChange,
	friendAccountId,
	friendName,
	defaultAmount,
	defaultCurrency,
}: RecordPaymentDialogProps) {
	const { createTransaction, isCreating } = useTransactionsQuery({});
	const [amount, setAmount] = React.useState(defaultAmount);
	const [notes, setNotes] = React.useState("");
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (open) {
			setAmount(defaultAmount);
			setNotes("");
			setError(null);
		}
	}, [open, defaultAmount]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const parsedAmount = parseFloat(amount);
		if (!amount || parsedAmount <= 0) {
			setError("Enter an amount above zero.");
			return;
		}

		setError(null);
		try {
			await createTransaction({
				accountId: friendAccountId,
				txDate: new Date(),
				txAmount: {
					currencyCode: defaultCurrency,
					units: Math.floor(parsedAmount).toString(),
					nanos: Math.round((parsedAmount % 1) * 1e9),
				},
				// outgoing on a friend account reduces what they owe you
				direction: TransactionDirection.DIRECTION_OUTGOING,
				description: `Payment from ${friendName}`,
				userNotes: notes || undefined,
			});
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't record payment");
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[380px]">
				<form onSubmit={handleSubmit} className="space-y-4">
					<DialogHeader>
						<DialogTitle>payment from {friendName}</DialogTitle>
					</DialogHeader>

					<Field label="Amount">
						<div className="flex items-center gap-2">
							<span className="w-10 shrink-0 text-sm text-muted-foreground">
								{defaultCurrency}
							</span>
							<Input
								type="number"
								step="0.01"
								min="0"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								placeholder="0.00"
								autoFocus
								required
							/>
						</div>
					</Field>

					<Field label="Notes">
						<Input
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Optional"
						/>
					</Field>

					<FormError>{error}</FormError>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isCreating}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isCreating}>
							{isCreating ? "Saving…" : "Record"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
