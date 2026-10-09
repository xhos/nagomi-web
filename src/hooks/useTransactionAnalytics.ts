import { useMemo } from "react";
import { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { formatAmount } from "@/lib/utils/transaction";

export function useTransactionAnalytics(transactions: Transaction[]) {
	return useMemo(() => {
		let totalIncome = 0;
		let totalExpenses = 0;

		transactions.forEach((transaction) => {
			// a transfer between own accounts only costs its fee
			if (transaction.transfer) {
				totalExpenses += formatAmount(transaction.transfer.fee);
				return;
			}
			const amount = formatAmount(transaction.txAmount);
			const normalizedDirection =
				typeof transaction.direction === "string"
					? TransactionDirection[
							transaction.direction as keyof typeof TransactionDirection
						]
					: transaction.direction;

			if (normalizedDirection === TransactionDirection.DIRECTION_INCOMING) {
				totalIncome += amount;
			} else {
				totalExpenses += amount;
			}
		});

		const netAmount = totalIncome - totalExpenses;
		const transactionCount = transactions.length;
		const averagePerTransaction =
			transactionCount > 0 ? netAmount / transactionCount : 0;
		const totalFlow = totalIncome + totalExpenses;
		const incomePercentage =
			totalFlow > 0 ? (totalIncome / totalFlow) * 100 : 0;
		const expensePercentage =
			totalFlow > 0 ? (totalExpenses / totalFlow) * 100 : 0;

		return {
			totalIncome,
			totalExpenses,
			netAmount,
			transactionCount,
			averagePerTransaction,
			incomePercentage,
			expensePercentage,
		};
	}, [transactions]);
}
