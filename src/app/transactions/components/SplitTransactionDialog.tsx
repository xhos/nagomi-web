"use client";

import * as React from "react";
import { Caption, HStack, Muted, VStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AccountType } from "@/gen/nagomi/v1/enums_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useAccounts } from "@/hooks/useAccounts";
import { useSplitTransaction } from "@/hooks/useSplits";
import { formatAmount, formatCurrency } from "@/lib/utils/transaction";

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
			setError("enter an amount for at least one friend");
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
			setError(err instanceof Error ? err.message : "failed to create split");
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle>split transaction</DialogTitle>
				</DialogHeader>

				<VStack spacing="lg" className="py-2">
					<div className="rounded border border-border p-3 bg-muted/30">
						<HStack spacing="sm" justify="between">
							<VStack spacing="xs" align="start">
								<div className="text-sm font-medium">
									{transaction.description ||
										transaction.merchant ||
										"transaction"}
								</div>
								<Muted size="xs">
									{transaction.txDate?.seconds
										? new Date(
												Number(transaction.txDate.seconds) * 1000,
											).toLocaleDateString()
										: ""}
								</Muted>
							</VStack>
							<div className="text-sm font-mono font-semibold">
								{formatCurrency(
									formatAmount(transaction.txAmount),
									currencyCode,
								)}
							</div>
						</HStack>
					</div>

					{friendAccounts.length === 0 ? (
						<VStack spacing="xs" align="center" className="py-4">
							<Muted size="sm">no friend accounts yet</Muted>
							<Muted size="xs">
								create a friend account first from the accounts page
							</Muted>
						</VStack>
					) : (
						<VStack spacing="sm">
							<Caption>assign amounts</Caption>
							{friendAccounts.map((account) => (
								<HStack
									key={account.id.toString()}
									spacing="md"
									justify="between"
									align="center"
								>
									<div className="text-sm flex-1 truncate">
										{account.friendlyName || account.name}
									</div>
									<HStack spacing="xs" align="center">
										<Muted size="xs" className="font-mono">
											{currencyCode}
										</Muted>
										<Input
											type="number"
											step="0.01"
											min="0"
											placeholder="0.00"
											className="w-28 font-mono text-sm"
											value={splitAmounts[account.id.toString()] ?? ""}
											onChange={(e) =>
												setSplitAmounts((prev) => ({
													...prev,
													[account.id.toString()]: e.target.value,
												}))
											}
										/>
									</HStack>
								</HStack>
							))}
						</VStack>
					)}

					{friendAccounts.length > 0 && (
						<HStack
							spacing="sm"
							justify="between"
							className="pt-2 border-t border-border text-sm"
						>
							<Muted size="sm">assigned</Muted>
							<span
								className={`font-mono text-sm ${totalAssigned > sourceAmount + 0.001 ? "text-destructive" : ""}`}
							>
								{formatCurrency(totalAssigned, currencyCode)}
								<span className="text-muted-foreground ml-2">
									/ {formatCurrency(sourceAmount, currencyCode)}
								</span>
							</span>
						</HStack>
					)}

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
						disabled={isPending}
					>
						cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={isPending || activeSplits.length === 0}
					>
						{isPending ? "splitting..." : `split (${activeSplits.length})`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
