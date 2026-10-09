"use client";

import { FileUp, Plus } from "lucide-react";
import { useEffect, useState } from "react";
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
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useUserId } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPES } from "@/lib/utils/account";
import {
	AccountDialog,
	type AccountFormData,
} from "./components/AccountDialog";
import { AccountRow } from "./components/AccountRow";
import { ImportCsvDialog } from "./components/ImportCsvDialog";
import { ImportPickerDialog } from "./components/ImportPickerDialog";
import { ImportStatementsDialog } from "./components/ImportStatementsDialog";
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
	// ?account=<id> opens that account, e.g. from an overview alert. read after
	// mount: on a client-side navigation the url isn't updated during render
	useEffect(() => {
		const id = new URLSearchParams(window.location.search).get("account");
		if (id) setExpandedId(id);
	}, []);
	const [creatingOpen, setCreatingOpen] = useState(false);
	const [importOpen, setImportOpen] = useState(false);
	const [csvOpen, setCsvOpen] = useState(false);
	const [pdfFiles, setPdfFiles] = useState<File[]>([]);
	const [csvFiles, setCsvFiles] = useState<File[]>([]);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [draggingOver, setDraggingOver] = useState(false);
	// each file goes to the dialog for its type
	const pickImportFiles = (files: File[]) => {
		const isCsv = (f: File) => f.name.toLowerCase().endsWith(".csv");
		const csv = files.filter(isCsv);
		const pdf = files.filter((f) => !isCsv(f));
		if (!files.length) return;
		setPickerOpen(false);
		if (pdf.length) {
			setPdfFiles(pdf);
			setImportOpen(true);
		}
		if (csv.length) {
			setCsvFiles(csv);
			setCsvOpen(true);
		}
	};
	const [editing, setEditing] = useState<Account | null>(null);
	const [merging, setMerging] = useState<Account | null>(null);
	const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
	const [error, setError] = useState<string | null>(null);

	const [bulkConfirm, setBulkConfirm] = useState(false);
	const [bulkDeleting, setBulkDeleting] = useState(false);

	const save = async (data: AccountFormData) => {
		if (editing) {
			await updateAccountAsync({
				id: editing.id,
				name: data.name,
				bank: data.bank,
				accountType: data.type,
				friendlyName: data.friendlyName,
				mainCurrency: data.mainCurrency,
				color: data.color,
				statementDriven: data.statementDriven,
				statementSettings: data.statementSettings,
			});
		} else {
			const created = await createAccountAsync(data);
			// create takes only the toggle; the settings need an update
			const s = data.statementSettings;
			if (created && s && Object.values(s).some((v) => v !== undefined))
				await updateAccountAsync({
					id: created.id,
					name: created.name,
					bank: created.bank,
					accountType: created.type,
					friendlyName: created.friendlyName,
					statementSettings: s,
				});
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

	// selection follows the grouped display order so shift-click ranges match
	const ordered = groups.flatMap((g) => g.accounts);
	const { isSelected, toggleSelection, clearSelection, getSelectedItems } =
		useMultiSelect({ items: ordered, getId: (a) => a.id });
	const selected = getSelectedItems();

	const confirmBulkDelete = async () => {
		setBulkDeleting(true);
		const failed: string[] = [];
		for (const a of selected) {
			try {
				await deleteAccountAsync(a.id);
			} catch {
				failed.push(a.friendlyName || a.name);
			}
		}
		setBulkDeleting(false);
		setBulkConfirm(false);
		setError(failed.length ? `Couldn't delete: ${failed.join(", ")}` : null);
	};

	return (
		<PageContainer>
			<PageContent>
				<PageHeaderWithTitle
					title="accounts"
					actions={
						<>
							<Button
								variant="outline"
								onClick={() => setPickerOpen(true)}
								onDragOver={(e) => {
									e.preventDefault();
									setDraggingOver(true);
								}}
								onDragLeave={(e) => {
									if (!e.currentTarget.contains(e.relatedTarget as Node | null))
										setDraggingOver(false);
								}}
								onDrop={(e) => {
									e.preventDefault();
									setDraggingOver(false);
									pickImportFiles(Array.from(e.dataTransfer.files));
								}}
								className={cn(
									draggingOver &&
										"border-dashed border-primary bg-accent text-accent-foreground ring-[3px] ring-primary/40 dark:border-primary dark:bg-accent",
								)}
							>
								<FileUp />
								Import
							</Button>
							<Button onClick={() => setCreatingOpen(true)} disabled={creating}>
								<Plus />
								New
							</Button>
						</>
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
					<div
						className="space-y-8"
						data-selecting={selected.length > 0 || undefined}
					>
						{selected.length > 0 && (
							<div className="sticky top-0 z-10 flex items-center gap-x-6 border-b bg-background py-2 text-sm">
								<span className="font-medium">{selected.length} selected</span>
								<span className="ml-auto flex gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => setBulkConfirm(true)}
									>
										Delete
									</Button>
									<Button variant="ghost" size="sm" onClick={clearSelection}>
										Clear
									</Button>
								</span>
							</div>
						)}
						{groups.map((g) => (
							<ListGroup key={g.type} title={g.title}>
								{g.accounts.map((account) => (
									<AccountRow
										key={account.id.toString()}
										account={account}
										expanded={expandedId === account.id.toString()}
										selected={isSelected(account.id)}
										onSelect={(e) =>
											toggleSelection(
												account.id,
												ordered.findIndex((a) => a.id === account.id),
												e,
											)
										}
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

				<ImportPickerDialog
					open={pickerOpen}
					onOpenChange={setPickerOpen}
					onFiles={pickImportFiles}
				/>

				<ImportStatementsDialog
					open={importOpen}
					onOpenChange={setImportOpen}
					initialFiles={pdfFiles}
					accounts={accounts}
				/>

				<ImportCsvDialog
					open={csvOpen}
					onOpenChange={setCsvOpen}
					initialFiles={csvFiles}
					accounts={accounts}
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

				<AlertDialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								Delete {selected.length} account
								{selected.length === 1 ? "" : "s"}?
							</AlertDialogTitle>
							<AlertDialogDescription>
								Their transactions will be deleted too. This can't be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={bulkDeleting}>
								Cancel
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={confirmBulkDelete}
								disabled={bulkDeleting}
							>
								{bulkDeleting ? "Deleting…" : "Delete"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

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
