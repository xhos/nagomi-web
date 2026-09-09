"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";
import { Card, ErrorMessage, Mono, Muted, VStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Account } from "@/gen/nagomi/v1/account_pb";

interface AnchorBalanceDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account: Account | null;
	onConfirm: (balance: {
		currencyCode: string;
		units: string;
		nanos: number;
	}) => Promise<void>;
}

export function AnchorBalanceDialog({
	open,
	onOpenChange,
	account,
	onConfirm,
}: AnchorBalanceDialogProps) {
	const [amount, setAmount] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (open && account) {
			if (account.anchorBalance) {
				const units = parseFloat(
					account.anchorBalance.units?.toString() || "0",
				);
				const nanos = (account.anchorBalance.nanos || 0) / 1e9;
				setAmount((units + nanos).toString());
			} else {
				setAmount("");
			}
			setError(null);
		}
	}, [account, open]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!account) return;

		if (!amount) {
			setError("Please enter a valid amount");
			return;
		}

		setIsLoading(true);
		try {
			const numAmount = parseFloat(amount);
			const units = Math.trunc(numAmount);
			const nanos = Math.round((numAmount - units) * 1e9);

			await onConfirm({
				currencyCode: account.mainCurrency || "USD",
				units: units.toString(),
				nanos,
			});
			onOpenChange(false);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to set anchor balance",
			);
		} finally {
			setIsLoading(false);
		}
	};

	if (!account) return null;

	const formatAnchorDate = () => {
		if (!account.anchorDate) return null;
		try {
			const date = new Date(Number(account.anchorDate.seconds) * 1000);
			return format(date, "PPP 'at' p");
		} catch {
			return null;
		}
	};

	const anchorDate = formatAnchorDate();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>set anchor balance</DialogTitle>
						<DialogDescription>
							Set the reference balance for{" "}
							<Mono className="font-medium">{account.name}</Mono> at a specific
							point in time. This is used to calculate running balances for
							transactions.
						</DialogDescription>
					</DialogHeader>
					<VStack spacing="md" className="py-4">
						{anchorDate && (
							<Card variant="subtle" padding="sm">
								<VStack spacing="xs">
									<Muted size="xs">Last anchor set</Muted>
									<Mono size="sm">{anchorDate}</Mono>
								</VStack>
							</Card>
						)}

						<VStack spacing="xs">
							<Label htmlFor="amount">amount *</Label>
							<div className="flex items-center gap-2">
								<Input
									id="amount"
									type="number"
									step="0.01"
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
									placeholder="0.00"
									disabled={isLoading}
									required
									min={undefined}
								/>
								<span className="text-sm text-muted-foreground shrink-0">
									{account.mainCurrency || "USD"}
								</span>
							</div>
						</VStack>

						{error && <ErrorMessage>{error}</ErrorMessage>}
					</VStack>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isLoading}
						>
							cancel
						</Button>
						<Button type="submit" disabled={isLoading}>
							{isLoading ? "Setting..." : "set anchor balance"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
