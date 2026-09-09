import { Caption, Card, HStack, Muted, Text, VStack } from "@/components/lib";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { formatAmount, formatCurrency } from "@/lib/utils/transaction";

interface TransactionDetailsProps {
	transaction: Transaction;
}

export function TransactionDetails({ transaction }: TransactionDetailsProps) {
	const hasUserNotes = !!transaction.userNotes;
	const hasBalanceAfter = !!transaction.balanceAfter;
	const hasForeignAmount = !!transaction.foreignAmount;
	const hasExchangeRate = !!transaction.exchangeRate;

	const hasAnyDetails =
		hasUserNotes || hasBalanceAfter || hasForeignAmount || hasExchangeRate;

	return (
		<Card variant="subtle" padding="sm">
			<VStack spacing="md">
				{/* Main Details Grid */}
				{hasAnyDetails && (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{transaction.userNotes && (
							<VStack spacing="xs" align="start">
								<Caption>USER NOTES</Caption>
								<Muted size="sm">{transaction.userNotes}</Muted>
							</VStack>
						)}

						{transaction.balanceAfter && (
							<VStack spacing="xs" align="start">
								<Caption>BALANCE AFTER</Caption>
								<Text size="sm" className="font-mono">
									{formatCurrency(
										formatAmount(transaction.balanceAfter),
										transaction.balanceAfter?.currencyCode,
									)}
								</Text>
							</VStack>
						)}

						{transaction.foreignAmount && (
							<VStack spacing="xs" align="start">
								<Caption>FOREIGN AMOUNT</Caption>
								<Text size="sm" className="font-mono">
									{formatCurrency(
										formatAmount(transaction.foreignAmount),
										transaction.foreignAmount?.currencyCode,
									)}
								</Text>
							</VStack>
						)}

						{transaction.exchangeRate && (
							<VStack spacing="xs" align="start">
								<Caption>EXCHANGE RATE</Caption>
								<Text size="sm" className="font-mono">
									{transaction.exchangeRate}
								</Text>
							</VStack>
						)}
					</div>
				)}

				{/* Metadata Footer */}
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
		</Card>
	);
}
