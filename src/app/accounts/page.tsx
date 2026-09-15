"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	PageContainer,
	PageContent,
	PageHeaderWithTitle,
} from "@/components/ui/layout";
import { EmptyState, ListGroup } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import type { Account } from "@/gen/nagomi/v1/account_pb";
import {
	useAccounts,
	useCreateAccount,
	useDeleteAccount,
	useMergeAccounts,
	useSetAnchorBalance,
	useUpdateAccount,
} from "@/hooks/useAccounts";
import { useUserId } from "@/hooks/useSession";
import { ACCOUNT_TYPES } from "@/lib/utils/account";
import {
	AccountDialog,
	type AccountFormData,
} from "./components/AccountDialog";
import { AccountRow } from "./components/AccountRow";
import { MergeAccountDialog } from "./components/MergeAccountDialog";

const friendly = (e: unknown, fallback: string) => {
	const m = e instanceof Error ? e.message : fallback;
	return m.includes("duplicate key")
		? "An account with this name already exists."
		: m;
};

export default function AccountsPage() {
	const userId = useUserId();
	const { accounts, isLoading } = useAccounts();
	const { createAccountAsync, isPending: creating } = useCreateAccount();
	const { updateAccountAsync } = useUpdateAccount();
	const { deleteAccountAsync, isPending: deleting } = useDeleteAccount();
	const { setAnchorBalanceAsync } = useSetAnchorBalance();
	const { mergeAccountsAsync } = useMergeAccounts();

	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [creatingOpen, setCreatingOpen] = useState(false);
	const [editing, setEditing] = useState<Account | null>(null);
	const [merging, setMerging] = useState<Account | null>(null);
	const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
	const [error, setError] = useState<string | null>(null);

	const save = async (data: AccountFormData) => {
		if (editing) {
			await updateAccountAsync({
				id: editing.id,
				name: data.name,
				bank: data.bank,
				accountType: data.type,
				friendlyName: data.friendlyName,
				mainCurrency: data.mainCurrency,
				colors: data.colors,
			});
		} else {
			await createAccountAsync(data);
		}
	};

	const confirmDelete = async () => {
		if (!deletingAccount) return;
		try {
			await deleteAccountAsync(deletingAccount.id);
			setDeletingAccount(null);
			setError(null);
		} catch (e) {
			setError(friendly(e, "Couldn't delete account"));
			setDeletingAccount(null);
		}
	};

	const groups = ACCOUNT_TYPES.map(([type, , plural]) => ({
		type,
		title: plural,
		accounts: accounts.filter((a) => a.type === type),
	})).filter((g) => g.accounts.length);

	return (
		<PageContainer>
			<PageContent>
				<PageHeaderWithTitle
					title="accounts"
					actions={
						<Button onClick={() => setCreatingOpen(true)} disabled={creating}>
							<Plus />
							New
						</Button>
					}
				/>

				{error && <p className="mb-4 text-sm text-destructive">{error}</p>}

				{isLoading || !userId ? (
					<div className="space-y-3">
						{[0, 1, 2, 3].map((i) => (
							<div key={i} className="flex justify-between py-2">
								<div className="space-y-2">
									<Skeleton className="h-4 w-40" />
									<Skeleton className="h-3 w-28" />
								</div>
								<Skeleton className="h-4 w-24" />
							</div>
						))}
					</div>
				) : accounts.length === 0 ? (
					<EmptyState
						text="No accounts yet."
						action="Add account"
						onAction={() => setCreatingOpen(true)}
					/>
				) : (
					<div className="space-y-8">
						{groups.map((g) => (
							<ListGroup key={g.type} title={g.title}>
								{g.accounts.map((account) => (
									<AccountRow
										key={account.id.toString()}
										account={account}
										expanded={expandedId === account.id.toString()}
										onToggle={() =>
											setExpandedId((cur) =>
												cur === account.id.toString()
													? null
													: account.id.toString(),
											)
										}
										onEdit={() => setEditing(account)}
										onMerge={
											accounts.length > 1
												? () => setMerging(account)
												: undefined
										}
										onDelete={() => setDeletingAccount(account)}
										onSetAnchor={async (amount) => {
											if (!userId) return;
											await setAnchorBalanceAsync({
												userId,
												id: account.id,
												balance: {
													units: Math.trunc(amount).toString(),
													nanos: Math.round(
														(amount - Math.trunc(amount)) * 1e9,
													),
												},
											});
										}}
									/>
								))}
							</ListGroup>
						))}
					</div>
				)}

				<AccountDialog
					open={creatingOpen || !!editing}
					onOpenChange={(o) => {
						if (!o) {
							setCreatingOpen(false);
							setEditing(null);
						}
					}}
					account={editing}
					onSave={save}
				/>

				<MergeAccountDialog
					open={!!merging}
					onOpenChange={(o) => !o && setMerging(null)}
					account={merging}
					allAccounts={accounts}
					onConfirm={async (primaryAccountId) => {
						if (!merging) throw new Error("No account selected");
						const r = await mergeAccountsAsync({
							primaryAccountId,
							secondaryAccountId: merging.id,
						});
						return { transactionsMoved: r.transactionsMoved };
					}}
				/>

				<AlertDialog
					open={!!deletingAccount}
					onOpenChange={(o) => !o && setDeletingAccount(null)}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								Delete {deletingAccount?.friendlyName || deletingAccount?.name}?
							</AlertDialogTitle>
							<AlertDialogDescription>
								Its transactions will be deleted too. This can't be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
							<AlertDialogAction onClick={confirmDelete} disabled={deleting}>
								{deleting ? "Deleting…" : "Delete"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</PageContent>
		</PageContainer>
	);
}
