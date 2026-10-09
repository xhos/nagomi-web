"use client";

import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { useEffect, useState } from "react";
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
import { ListRow } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountType, TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useAccounts } from "@/hooks/useAccounts";
import { useUserId } from "@/hooks/useSession";
import { useLinkTransfer } from "@/hooks/useTransfers";
import { transactionsApi } from "@/lib/api/transactions";
import { formatAmount } from "@/lib/utils/transaction";

const WINDOW_DAYS = 7;
const SHOWN = 8;

const dateOf = (t: Transaction) =>
	new Date(Number(t.txDate?.seconds ?? 0) * 1000);

// the other side of a transfer: opposite direction on another own account,
// within a week. same-currency ones by closest amount, then other currencies
// by date
function useCounterparts(tx: Transaction | null) {
	const userId = useUserId();
	const { accounts } = useAccounts();
	return useQuery({
		queryKey: [
			"transactions",
			"transfer-candidates",
			userId,
			tx?.id.toString(),
		],
		enabled: !!userId && !!tx,
		queryFn: async () => {
			if (!userId || !tx) return [];
			const at = dateOf(tx);
			const { transactions } = await transactionsApi.list({
				userId,
				limit: 500,
				startDate: addDays(at, -WINDOW_DAYS),
				endDate: addDays(at, WINDOW_DAYS),
				direction:
					tx.direction === TransactionDirection.DIRECTION_OUTGOING
						? TransactionDirection.DIRECTION_INCOMING
						: TransactionDirection.DIRECTION_OUTGOING,
			});
			const friends = new Set(
				accounts
					.filter((a) => a.type === AccountType.ACCOUNT_FRIEND)
					.map((a) => a.id),
			);
			const amount = formatAmount(tx.txAmount);
			const currency = tx.txAmount?.currencyCode;
			// a fee or rounding may change the amount a little; another
			// currency can be anything
			const gap = (c: Transaction) =>
				c.txAmount?.currencyCode === currency
					? Math.abs(formatAmount(c.txAmount) - amount)
					: 0;
			const close = (c: Transaction) =>
				c.txAmount?.currencyCode !== currency || gap(c) <= amount * 0.1 + 10;
			const days = (c: Transaction) =>
				Math.abs(+dateOf(c) - +dateOf(tx)) / 86_400_000;
			return transactions
				.filter(
					(c) =>
						c.accountId !== tx.accountId &&
						!friends.has(c.accountId) &&
						!c.transfer &&
						!c.splitFromId &&
						close(c),
				)
				.sort(
					(a, b) =>
						Number(a.txAmount?.currencyCode !== currency) -
							Number(b.txAmount?.currencyCode !== currency) ||
						gap(a) - gap(b) ||
						days(a) - days(b),
				)
				.slice(0, SHOWN);
		},
	});
}

interface TransferDialogProps {
	transaction: Transaction | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function TransferDialog({
	transaction: tx,
	open,
	onOpenChange,
}: TransferDialogProps) {
	const { getAccountDisplayName } = useAccounts();
	const { data: candidates = [], isLoading } = useCounterparts(
		open ? tx : null,
	);
	const link = useLinkTransfer();
	const [picked, setPicked] = useState<bigint | null>(null);

	useEffect(() => {
		if (open) {
			setPicked(null);
			link.reset();
		}
	}, [open, link.reset]);

	if (!tx) return null;
	const outgoing = tx.direction === TransactionDirection.DIRECTION_OUTGOING;

	const save = () => {
		if (picked === null) return;
		link.mutate(
			outgoing
				? { outgoingId: tx.id, incomingId: picked }
				: { outgoingId: picked, incomingId: tx.id },
			{ onSuccess: () => onOpenChange(false) },
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[520px]">
				<DialogHeader>
					<DialogTitle>mark as transfer</DialogTitle>
					<DialogDescription>
						{tx.description || tx.merchant || "Transaction"} ·{" "}
						<Amount
							value={formatAmount(tx.txAmount)}
							currency={tx.txAmount?.currencyCode}
						/>{" "}
						{outgoing ? "left" : "arrived in"}{" "}
						{getAccountDisplayName(tx.accountId, tx.accountName)}. Pick where it{" "}
						{outgoing ? "went" : "came from"}.
					</DialogDescription>
				</DialogHeader>

				{isLoading ? (
					<div className="space-y-3 py-2">
						{[0, 1, 2].map((i) => (
							<Skeleton key={i} className="h-10 w-full" />
						))}
					</div>
				) : candidates.length === 0 ? (
					<p className="py-4 text-sm text-muted-foreground">
						Nothing on your other accounts within a week of it.
					</p>
				) : (
					<div className="divide-y">
						{candidates.map((c) => (
							<ListRow
								key={c.id.toString()}
								selected={picked === c.id}
								onClick={() => setPicked(c.id)}
							>
								<div className="flex items-start gap-3">
									<div className="min-w-0 flex-1">
										<div className="truncate font-medium">
											{getAccountDisplayName(c.accountId, c.accountName)}
										</div>
										<div className="mt-0.5 truncate text-sm text-muted-foreground">
											{dateOf(c).toLocaleDateString("en-US", {
												month: "short",
												day: "numeric",
											})}
											{" · "}
											{c.description || c.merchant}
										</div>
									</div>
									<Amount
										value={formatAmount(c.txAmount)}
										currency={c.txAmount?.currencyCode}
										className="shrink-0 font-medium"
									/>
								</div>
							</ListRow>
						))}
					</div>
				)}

				<FormError>{link.error?.message}</FormError>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={link.isPending}
					>
						Cancel
					</Button>
					<Button onClick={save} disabled={link.isPending || picked === null}>
						{link.isPending ? "Linking…" : "Link"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
