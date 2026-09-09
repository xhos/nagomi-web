"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, ErrorMessage, HStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import {
	PageContainer,
	PageContent,
	PageHeaderWithTitle,
} from "@/components/ui/layout";
import type { Account } from "@/gen/nagomi/v1/account_pb";
import { AccountType } from "@/gen/nagomi/v1/enums_pb";
import {
	useAccounts,
	useCreateAccount,
	useDeleteAccount,
	useMergeAccounts,
	useSetAnchorBalance,
	useUpdateAccount,
} from "@/hooks/useAccounts";
import { useUserId } from "@/hooks/useSession";
import { AccountDialog } from "./components/AccountDialog";
import AccountGrid from "./components/AccountGrid";
import { DeleteAccountDialog } from "./components/DeleteAccountDialog";
import FilterChips from "./components/FilterChips";
import { MergeAccountDialog } from "./components/MergeAccountDialog";

const getAccountTypeName = (accountType: AccountType): string => {
	// Handle both string and numeric enum values
	const normalizedType =
		typeof accountType === "string"
			? AccountType[accountType as keyof typeof AccountType]
			: accountType;

	switch (normalizedType) {
		case AccountType.ACCOUNT_UNSPECIFIED:
			return "unspecified";
		case AccountType.ACCOUNT_CHEQUING:
			return "chequing";
		case AccountType.ACCOUNT_SAVINGS:
			return "savings";
		case AccountType.ACCOUNT_CREDIT_CARD:
			return "credit card";
		case AccountType.ACCOUNT_INVESTMENT:
			return "investment";
		case AccountType.ACCOUNT_OTHER:
			return "other";
		case AccountType.ACCOUNT_FRIEND:
			return "friend";
		default:
			return "unknown";
	}
};
//TODO: decimal support for balance on create account
export default function AccountsPage() {
	const userId = useUserId();
	const { accounts } = useAccounts();

	const [error, setError] = useState("");
	const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
	const [editingAccount, setEditingAccount] = useState<Account | null>(null);
	const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
	const [mergingAccount, setMergingAccount] = useState<Account | null>(null);
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

	const { createAccountAsync, isPending: isCreating } = useCreateAccount();
	const { updateAccountAsync, isPending: isUpdating } = useUpdateAccount();
	const { deleteAccountAsync, isPending: isDeleting } = useDeleteAccount();
	const { setAnchorBalanceAsync, isPending: isSettingAnchor } =
		useSetAnchorBalance();
	const { mergeAccountsAsync } = useMergeAccounts();

	const handleDeleteAccount = async () => {
		if (!deletingAccount) return;
		try {
			await deleteAccountAsync(deletingAccount.id);
			setError("");
			setDeletingAccount(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete account");
		}
	};

	const handleMergeAccount = async (primaryAccountId: bigint) => {
		if (!mergingAccount) throw new Error("No account selected for merge");
		const result = await mergeAccountsAsync({
			primaryAccountId,
			secondaryAccountId: mergingAccount.id,
		});
		return { transactionsMoved: result.transactionsMoved };
	};

	const handleSaveAnchor = async (
		account: Account,
		balance: { units: string; nanos: number },
	) => {
		if (!userId) return;
		try {
			await setAnchorBalanceAsync({ userId, id: account.id, balance });
			setError("");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to set anchor balance",
			);
			throw err;
		}
	};

	const handleCreateAccount = async (data: {
		name: string;
		bank: string;
		type: AccountType;
		friendlyName?: string;
		anchorBalance?: { currencyCode: string; units: string; nanos: number };
		mainCurrency?: string;
		colors?: string[];
	}) => {
		try {
			await createAccountAsync(data);
			setError("");
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to create account";
			if (errorMessage.includes("duplicate key")) {
				setError(
					"An account with this name already exists. Please choose a different name.",
				);
			} else {
				setError(errorMessage);
			}
			throw err;
		}
	};

	const handleUpdateAccount = async (data: {
		name: string;
		bank: string;
		type: AccountType;
		friendlyName?: string;
		mainCurrency?: string;
		colors?: string[];
	}) => {
		if (!editingAccount) return;
		try {
			await updateAccountAsync({
				id: editingAccount.id,
				name: data.name,
				bank: data.bank,
				accountType: data.type,
				friendlyName: data.friendlyName,
				mainCurrency: data.mainCurrency,
				colors: data.colors,
			});
			setError("");
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to update account";
			if (errorMessage.includes("duplicate key")) {
				setError(
					"An account with this name already exists. Please choose a different name.",
				);
			} else {
				setError(errorMessage);
			}
			throw err;
		}
	};

	const isOperationLoading =
		isCreating || isUpdating || isDeleting || isSettingAnchor;

	const availableTypes = useMemo(() => {
		const types = new Set(
			accounts.map((account) => getAccountTypeName(account.type)),
		);
		return Array.from(types).sort();
	}, [accounts]);

	const availableBanks = useMemo(() => {
		const banks = new Set(accounts.map((account) => account.bank));
		return Array.from(banks).sort();
	}, [accounts]);

	if (!userId) {
		return (
			<PageContainer>
				<PageContent>
					<div className="text-sm text-muted-foreground">
						loading session...
					</div>
				</PageContent>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageContent>
				<PageHeaderWithTitle title="accounts" />

				{error && <ErrorMessage className="mb-6">{error}</ErrorMessage>}

				{accounts.length > 0 && (
					<HStack spacing="md" justify="between" className="mb-6">
						<FilterChips
							selectedFilter={selectedFilter}
							onFilterChange={setSelectedFilter}
							availableTypes={availableTypes}
							availableBanks={availableBanks}
						/>
						<Button
							onClick={() => setIsCreateDialogOpen(true)}
							size="default"
							disabled={isOperationLoading}
						>
							<Plus className="h-4 w-4" />
							new
						</Button>
					</HStack>
				)}

				{accounts.length === 0 ? (
					<EmptyState
						title="no accounts yet"
						description="create your first account to get started"
						action={
							<Button
								onClick={() => setIsCreateDialogOpen(true)}
								disabled={isOperationLoading}
							>
								<Plus className="h-4 w-4" />
								create your first account
							</Button>
						}
					/>
				) : (
					<AccountGrid
						accounts={accounts}
						selectedFilter={selectedFilter}
						getAccountTypeName={getAccountTypeName}
						onAccountClick={setEditingAccount}
						onEdit={setEditingAccount}
						onDelete={setDeletingAccount}
						onSaveAnchor={handleSaveAnchor}
						onMerge={accounts.length > 1 ? setMergingAccount : undefined}
					/>
				)}

				<AccountDialog
					open={isCreateDialogOpen}
					onOpenChange={setIsCreateDialogOpen}
					title="create account"
					onSave={handleCreateAccount}
				/>

				<AccountDialog
					open={!!editingAccount}
					onOpenChange={(open) => !open && setEditingAccount(null)}
					account={editingAccount}
					title="edit account"
					onSave={handleUpdateAccount}
				/>

				<DeleteAccountDialog
					open={!!deletingAccount}
					onOpenChange={(open) => !open && setDeletingAccount(null)}
					account={deletingAccount}
					getAccountTypeName={getAccountTypeName}
					onConfirm={handleDeleteAccount}
				/>

				<MergeAccountDialog
					open={!!mergingAccount}
					onOpenChange={(open) => !open && setMergingAccount(null)}
					account={mergingAccount}
					allAccounts={accounts}
					onConfirm={handleMergeAccount}
				/>
			</PageContent>
		</PageContainer>
	);
}
