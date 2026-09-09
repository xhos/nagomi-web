"use client";

import { useMemo } from "react";
import { VStack } from "@/components/lib";
import type { Account } from "@/gen/nagomi/v1/account_pb";
import type { AccountType } from "@/gen/nagomi/v1/enums_pb";
import AccountCard from "./AccountCard";

interface AccountGridProps {
	accounts: Account[];
	selectedFilter: string | null;
	getAccountTypeName: (type: AccountType) => string;
	onAccountClick: (account: Account) => void;
	onEdit?: (account: Account) => void;
	onDelete?: (account: Account) => void;
	onSaveAnchor?: (
		account: Account,
		balance: { units: string; nanos: number },
	) => Promise<void>;
	onMerge?: (account: Account) => void;
}

interface GroupedAccounts {
	[key: string]: Account[];
}

export default function AccountGrid({
	accounts,
	selectedFilter,
	getAccountTypeName,
	onAccountClick,
	onEdit,
	onDelete,
	onSaveAnchor,
	onMerge,
}: AccountGridProps) {
	const groupedAccounts = useMemo(() => {
		if (!selectedFilter) {
			return { "all accounts": accounts };
		}

		const grouped: GroupedAccounts = {};

		accounts.forEach((account) => {
			let groupKey: string;

			if (selectedFilter === "type") {
				groupKey = getAccountTypeName(account.type);
			} else if (selectedFilter === "bank") {
				groupKey = account.bank;
			} else {
				groupKey = "all accounts";
			}

			if (!grouped[groupKey]) {
				grouped[groupKey] = [];
			}
			grouped[groupKey].push(account);
		});

		// Sort groups alphabetically
		const sortedGrouped: GroupedAccounts = {};
		Object.keys(grouped)
			.sort()
			.forEach((key) => {
				sortedGrouped[key] = grouped[key];
			});

		return sortedGrouped;
	}, [accounts, selectedFilter, getAccountTypeName]);

	if (accounts.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<h3 className="text-sm font-mono lowercase text-muted-foreground mb-1">
					no accounts found
				</h3>
				<p className="text-xs font-mono lowercase text-muted-foreground/70">
					accounts matching your filter criteria will appear here
				</p>
			</div>
		);
	}

	return (
		<VStack spacing="2xl">
			{Object.entries(groupedAccounts).map(([groupName, groupAccounts]) => (
				<VStack key={groupName} spacing="md">
					{selectedFilter && (
						<span className="font-mono text-xs text-muted-foreground lowercase border-b border-border pb-2 block">
							{groupName}
						</span>
					)}

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
						{groupAccounts.map((account) => (
							<AccountCard
								key={account.id.toString()}
								account={account}
								getAccountTypeName={getAccountTypeName}
								onClick={() => onAccountClick(account)}
								onEdit={onEdit}
								onDelete={onDelete}
								onSaveAnchor={onSaveAnchor}
								onMerge={onMerge}
							/>
						))}
					</div>
				</VStack>
			))}
		</VStack>
	);
}
