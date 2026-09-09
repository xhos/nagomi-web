"use client";

import * as React from "react";
import { VStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/forms";
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
			setError("enter a valid amount");
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
				direction: TransactionDirection.DIRECTION_INCOMING,
				description: `Payment from ${friendName}`,
				userNotes: notes || undefined,
			});
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "failed to record payment");
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[380px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>record payment from {friendName}</DialogTitle>
					</DialogHeader>

					<VStack spacing="md" className="py-4">
						<FormField label="amount" required>
							<div className="flex items-center gap-2">
								<span className="text-sm text-muted-foreground font-mono w-10 shrink-0">
									{defaultCurrency}
								</span>
								<Input
									type="number"
									step="0.01"
									min="0"
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
									placeholder="0.00"
									className="font-mono"
									autoFocus
									required
								/>
							</div>
						</FormField>

						<FormField label="notes">
							<Input
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								placeholder="optional"
							/>
						</FormField>

						{error && (
							<p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-2">
								{error}
							</p>
						)}
					</VStack>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isCreating}
						>
							cancel
						</Button>
						<Button type="submit" disabled={isCreating}>
							{isCreating ? "saving..." : "record"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
