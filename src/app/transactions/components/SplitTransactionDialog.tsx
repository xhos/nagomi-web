"use client";

import * as React from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { FormError } from "@/components/ui/forms";
import { Input } from "@/components/ui/input";
import { AccountType } from "@/gen/nagomi/v1/enums_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useAccounts } from "@/hooks/useAccounts";
import { useSplitTransaction } from "@/hooks/useSplits";
import { cn } from "@/lib/utils";

interface SplitTransactionDialogProps {
	transaction: Transaction | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SplitTransactionDialog({
	transaction,
	open,
	onOpenChange,
}: SplitTransactionDialogProps) {
	const { accounts } = useAccounts();
	const { mutateAsync: splitTransaction, isPending } = useSplitTransaction();
	const [splitAmounts, setSplitAmounts] = React.useState<
		Record<string, string>
	>({});
	const [error, setError] = React.useState<string | null>(null);

	const friendAccounts = React.useMemo(
		() => accounts.filter((a) => a.type === AccountType.ACCOUNT_FRIEND),
		[accounts],
	);

	React.useEffect(() => {
		if (open) {
			setSplitAmounts({});
			setError(null);
		}
	}, [open]);

	if (!transaction) return null;

	const currencyCode = transaction.txAmount?.currencyCode || "USD";
	const sourceAmount =
		Number(transaction.txAmount?.units ?? BigInt(0)) +
		(transaction.txAmount?.nanos ?? 0) / 1e9;

	const totalAssigned = Object.values(splitAmounts).reduce(
		(sum, val) => sum + (parseFloat(val) || 0),
		0,
	);

	const activeSplits = friendAccounts.filter(
		(a) => parseFloat(splitAmounts[a.id.toString()] ?? "0") > 0,
	);

	const handleSubmit = async () => {
		if (activeSplits.length === 0) {
			setError("Enter an amount for at least one friend.");
			return;
		}

		setError(null);
		try {
			await splitTransaction({
				sourceTransactionId: transaction.id,
				splits: activeSplits.map((account) => {
					const amountValue = parseFloat(
						splitAmounts[account.id.toString()] ?? "0",
					);
					return {
						friendAccountId: account.id,
						amount: {
							currencyCode,
							units: Math.floor(amountValue).toString(),
							nanos: Math.round((amountValue % 1) * 1e9),
						},
					};
				}),
			});
			onOpenChange(false);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Couldn't split transaction",
			);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[460px]">
				<DialogHeader>
					<DialogTitle>split transaction</DialogTitle>
					<DialogDescription>
						{transaction.description || transaction.merchant || "Transaction"} ·{" "}
						<Amount value={sourceAmount} currency={currencyCode} />
					</DialogDescription>
				</DialogHeader>

				{friendAccounts.length === 0 ? (
					<p className="py-4 text-sm text-muted-foreground">
						No friend accounts yet. Add one on the accounts page first.
					</p>
				) : (
					<div className="divide-y">
						{friendAccounts.map((account) => (
							<div
								key={account.id.toString()}
								className="flex items-center justify-between gap-4 py-2 text-sm"
							>
								<span className="truncate">
									{account.friendlyName || account.name}
								</span>
								<Input
									type="number"
									step="0.01"
									min="0"
									placeholder="0.00"
									aria-label={`Amount for ${account.friendlyName || account.name}`}
									className="h-8 w-32"
									value={splitAmounts[account.id.toString()] ?? ""}
									onChange={(e) =>
										setSplitAmounts((prev) => ({
											...prev,
											[account.id.toString()]: e.target.value,
										}))
									}
								/>
							</div>
						))}
						<div className="flex items-center justify-between pt-3 text-sm">
							<span className="text-muted-foreground">Assigned</span>
							<span
								className={cn(
									"tabular-nums",
									totalAssigned > sourceAmount + 0.001 && "text-destructive",
								)}
							>
								<Amount value={totalAssigned} currency={currencyCode} />
								<span className="ml-1 text-muted-foreground">
									of <Amount value={sourceAmount} currency={currencyCode} />
								</span>
							</span>
						</div>
					</div>
				)}

				<FormError>{error}</FormError>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={isPending || activeSplits.length === 0}
					>
						{isPending ? "Splitting…" : "Split"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
