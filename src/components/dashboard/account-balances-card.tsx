"use client";

import { useQuery } from "@tanstack/react-query";
import { Caption, Card, HStack, VStack } from "@/components/lib";
import { Skeleton } from "@/components/ui/skeleton";
import type { Account } from "@/gen/nagomi/v1/account_pb";
import { AccountType } from "@/gen/nagomi/v1/enums_pb";
import { accountsApi } from "@/lib/api/accounts";
import { formatAmount } from "@/lib/utils/transaction";

interface AccountBalancesCardProps {
	userId: string;
}

const getAccountTypeLabel = (type: AccountType): string => {
	switch (type) {
		case AccountType.ACCOUNT_CHEQUING:
			return "checking";
		case AccountType.ACCOUNT_SAVINGS:
			return "savings";
		case AccountType.ACCOUNT_CREDIT_CARD:
			return "credit card";
		case AccountType.ACCOUNT_INVESTMENT:
			return "investment";
		case AccountType.ACCOUNT_OTHER:
			return "other";
		default:
			return "unknown";
	}
};

const sortAccountsByType = (accounts: Account[]) => {
	const typeOrder: Record<AccountType, number> = {
		[AccountType.ACCOUNT_UNSPECIFIED]: 99,
		[AccountType.ACCOUNT_CHEQUING]: 1,
		[AccountType.ACCOUNT_SAVINGS]: 2,
		[AccountType.ACCOUNT_INVESTMENT]: 3,
		[AccountType.ACCOUNT_OTHER]: 4,
		[AccountType.ACCOUNT_CREDIT_CARD]: 5,
		[AccountType.ACCOUNT_FRIEND]: 6,
	};

	return [...accounts].sort((a, b) => {
		const orderA = typeOrder[a.type as AccountType] ?? 99;
		const orderB = typeOrder[b.type as AccountType] ?? 99;
		return orderA - orderB;
	});
};

export function AccountBalancesCard({ userId }: AccountBalancesCardProps) {
	const { data, isLoading } = useQuery({
		queryKey: ["accounts", userId],
		queryFn: () => accountsApi.list(userId),
	});

	return (
		<Card padding="md" title="account balances">
			<VStack spacing="sm">
				{isLoading ? (
					["a", "b", "c"].map((k) => (
						<Skeleton key={k} className="h-12 w-full" />
					))
				) : data && data.length > 0 ? (
					sortAccountsByType(data).map((account, index) => {
						const balance = account.balance ? formatAmount(account.balance) : 0;
						const isDebt = account.type === AccountType.ACCOUNT_CREDIT_CARD;

						return (
							<HStack
								key={account.id}
								spacing="md"
								justify="between"
								className={index > 0 ? "border-t pt-3" : ""}
							>
								<VStack spacing="xs" align="start">
									<div className="text-sm font-medium">
										{account.friendlyName || account.name}
									</div>
									<Caption className="text-muted-foreground">
										{getAccountTypeLabel(account.type)}
									</Caption>
								</VStack>
								<div className="text-sm font-semibold tabular-nums">
									{isDebt && balance !== 0 ? "-" : ""}$
									{Math.abs(balance).toLocaleString("en-US", {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									})}
								</div>
							</HStack>
						);
					})
				) : (
					<div className="flex h-24 items-center justify-center">
						<div className="font-mono text-xs text-muted-foreground">
							no accounts found
						</div>
					</div>
				)}
			</VStack>
		</Card>
	);
}
