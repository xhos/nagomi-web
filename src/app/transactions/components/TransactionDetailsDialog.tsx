import { useState } from "react";
import { Caption, HStack, Muted, VStack } from "@/components/lib";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useAccounts } from "@/hooks/useAccounts";
import { useForgiveTransaction } from "@/hooks/useSplits";
import { getCategoryTextColor } from "@/lib/color-utils";
import { getCategoryDisplayName } from "@/lib/utils/category";
import {
	formatAmount,
	formatCurrency,
	formatTime,
} from "@/lib/utils/transaction";

interface TransactionDetailsDialogProps {
	transaction: Transaction;
}

export function TransactionDetailsDialog({
	transaction,
}: TransactionDetailsDialogProps) {
	const amount = formatAmount(transaction.txAmount);
	const formattedAmount = formatCurrency(
		amount,
		transaction.txAmount?.currencyCode,
	);
	const { mutate: forgive, isPending: isForgiving } = useForgiveTransaction();
	const { getAccountDisplayName } = useAccounts();
	const [forgiveError, setForgiveError] = useState<string | null>(null);

	const handleToggleForgiven = () => {
		setForgiveError(null);
		forgive(
			{ transactionId: transaction.id, forgiven: !transaction.forgiven },
			{
				onError: (err) =>
					setForgiveError(err instanceof Error ? err.message : "failed"),
			},
		);
	};

	return (
		<VStack spacing="lg" className="w-full">
			<VStack spacing="md" align="start">
				<div>
					<div className="text-2xl font-semibold">{formattedAmount}</div>
					<Muted size="sm">{formatTime(transaction.txDate)}</Muted>
				</div>
			</VStack>

			<VStack spacing="xs" align="start">
				<Caption>DESCRIPTION</Caption>
				<div className="text-sm">{transaction.description || "—"}</div>
			</VStack>

			{transaction.merchant &&
				transaction.description !== transaction.merchant && (
					<VStack spacing="xs" align="start">
						<Caption>MERCHANT</Caption>
						<div className="text-sm">{transaction.merchant}</div>
					</VStack>
				)}

			{transaction.category?.slug && (
				<VStack spacing="xs" align="start">
					<Caption>CATEGORY</Caption>
					<Badge
						variant="outline"
						className="text-xs border-0"
						style={{
							backgroundColor: transaction.category.color,
							color: getCategoryTextColor(transaction.category.slug),
						}}
					>
						{getCategoryDisplayName(transaction.category.slug)}
					</Badge>
				</VStack>
			)}

			{transaction.userNotes && (
				<VStack spacing="xs" align="start">
					<Caption>NOTES</Caption>
					<div className="text-sm italic">{transaction.userNotes}</div>
				</VStack>
			)}

			{/* Split source indicator */}
			{transaction.splitFromId && (
				<VStack spacing="xs" align="start">
					<Caption>SPLIT</Caption>
					<HStack spacing="sm" align="center">
						{transaction.forgiven ? (
							<Badge
								variant="outline"
								className="text-xs text-muted-foreground"
							>
								forgiven
							</Badge>
						) : (
							<Badge
								variant="outline"
								className="text-xs text-amber-600 border-amber-300"
							>
								outstanding
							</Badge>
						)}
						<Button
							size="sm"
							variant="ghost"
							className="h-6 text-xs px-2"
							onClick={handleToggleForgiven}
							disabled={isForgiving}
						>
							{transaction.forgiven ? "un-forgive" : "forgive"}
						</Button>
					</HStack>
					{forgiveError && (
						<Muted size="xs" className="text-destructive">
							{forgiveError}
						</Muted>
					)}
				</VStack>
			)}

			{/* Splits list (for source transactions) */}
			{transaction.splits.length > 0 && (
				<VStack spacing="sm" align="start">
					<Caption>SPLITS ({transaction.splits.length})</Caption>
					{transaction.splits.map((split) => (
						<HStack
							key={split.id.toString()}
							spacing="sm"
							justify="between"
							className="w-full"
						>
							<div className="text-sm">
								{getAccountDisplayName(split.accountId, split.accountName)}
							</div>
							<HStack spacing="sm" align="center">
								{split.forgiven && (
									<Badge
										variant="outline"
										className="text-xs text-muted-foreground"
									>
										forgiven
									</Badge>
								)}
								<span className="text-sm font-mono">
									{formatCurrency(
										formatAmount(split.txAmount),
										split.txAmount?.currencyCode,
									)}
								</span>
							</HStack>
						</HStack>
					))}
				</VStack>
			)}

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
				{transaction.balanceAfter && (
					<VStack spacing="xs" align="start">
						<Caption>BALANCE</Caption>
						<div className="font-mono text-sm">
							{formatCurrency(
								formatAmount(transaction.balanceAfter),
								transaction.balanceAfter?.currencyCode,
							)}
						</div>
					</VStack>
				)}

				{transaction.exchangeRate && (
					<VStack spacing="xs" align="start">
						<Caption>EXCHANGE RATE</Caption>
						<div className="font-mono text-sm">{transaction.exchangeRate}</div>
					</VStack>
				)}

				{transaction.foreignAmount && (
					<VStack spacing="xs" align="start">
						<Caption>FOREIGN AMOUNT</Caption>
						<div className="font-mono text-sm">
							{formatCurrency(
								formatAmount(transaction.foreignAmount),
								transaction.foreignAmount?.currencyCode,
							)}
						</div>
					</VStack>
				)}
			</div>

			<HStack spacing="lg" justify="between" className="pt-2 text-[11px]">
				<Muted size="xs">
					{transaction.createdAt?.seconds &&
						`created ${new Date(Number(transaction.createdAt.seconds) * 1000).toLocaleString()}`}
				</Muted>
				<Muted size="xs">
					{transaction.updatedAt?.seconds &&
						`updated ${new Date(Number(transaction.updatedAt.seconds) * 1000).toLocaleString()}`}
				</Muted>
			</HStack>
		</VStack>
	);
}
