"use client";

import { Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UICondition } from "@/app/rules/components/ConditionBuilder";
import { RuleDialog } from "@/app/rules/components/RuleDialog";
import { ErrorMessage, HStack, VStack } from "@/components/lib";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	PageContainer,
	PageContent,
	PageHeaderWithTitle,
} from "@/components/ui/layout";
import type { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useCategories } from "@/hooks/useCategories";
import { useCreateRule } from "@/hooks/useRules";
import { useTransactionsQuery } from "@/hooks/useTransactionsQuery";
import { SplitTransactionDialog } from "./components/SplitTransactionDialog";
import { TransactionDetailsDialog } from "./components/TransactionDetailsDialog";
import {
	type TransactionFilters,
	TransactionFiltersPanel,
} from "./components/TransactionFiltersPanel";
import { TransactionList } from "./components/TransactionList";
import { TransactionSidebar } from "./components/TransactionSidebar";
import { TransactionDialog } from "./components/transaction-dialog";

export default function TransactionsPage() {
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingTransaction, setEditingTransaction] =
		useState<Transaction | null>(null);
	const [selectedTransactions, setSelectedTransactions] = useState<
		Transaction[]
	>([]);
	const [detailsTransaction, setDetailsTransaction] =
		useState<Transaction | null>(null);
	const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
	const [splitTransaction, setSplitTransaction] = useState<Transaction | null>(
		null,
	);
	const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false);
	const [searchInput, setSearchInput] = useState("");
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
	const [isFiltersOpen, setIsFiltersOpen] = useState(false);
	const [filters, setFilters] = useState<TransactionFilters>({});
	const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
	const [rulePrefill, setRulePrefill] = useState<{
		ruleName: string;
		condition: UICondition;
	} | null>(null);

	// Debounce search input
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearchQuery(searchInput);
		}, 300);

		return () => clearTimeout(timer);
	}, [searchInput]);

	const { categories } = useCategories();
	const {
		createRule,
		isPending: isCreatingRule,
		error: createRuleError,
		reset: resetCreateRule,
	} = useCreateRule();

	// Use hook for mutations only (TransactionList handles its own query with search)
	const {
		deleteTransactions,
		createTransaction,
		updateTransaction,
		isCreating,
		isUpdating,
		createError,
		updateError,
		deleteError,
		refetch,
		isLoading,
	} = useTransactionsQuery({});

	const handleSelectionChange = useCallback((transactions: Transaction[]) => {
		setSelectedTransactions(transactions);
	}, []);

	const handleSaveTransaction = async (formData: {
		accountId: bigint;
		txDate: Date;
		txAmount: { currencyCode: string; units: string; nanos: number };
		direction: TransactionDirection;
		description?: string;
		merchant?: string;
		userNotes?: string;
		categoryId?: bigint;
	}) => {
		if (editingTransaction) {
			await updateTransaction({
				id: editingTransaction.id,
				...formData,
			});
		} else {
			await createTransaction(formData);
		}
		setIsDialogOpen(false);
		setEditingTransaction(null);
	};

	const handleClearSelection = () => {
		setSelectedTransactions([]);
	};

	const handleDeleteSelected = async () => {
		const transactionIds = selectedTransactions.map((t) => t.id);
		await deleteTransactions(transactionIds);
		handleClearSelection();
	};

	const handleBulkModify = () => {
		alert("Bulk modify functionality coming soon!");
	};

	const handleEditTransaction = (transaction: Transaction) => {
		setEditingTransaction(transaction);
		setIsDialogOpen(true);
	};

	const handleDialogOpenChange = (open: boolean) => {
		setIsDialogOpen(open);
		if (!open) {
			setEditingTransaction(null);
		}
	};

	const handleDeleteTransaction = async (transaction: Transaction) => {
		await deleteTransactions([transaction.id]);
	};

	const handleViewDetails = (transaction: Transaction) => {
		setDetailsTransaction(transaction);
		setIsDetailsDialogOpen(true);
	};

	const handleSplitTransaction = (transaction: Transaction) => {
		setSplitTransaction(transaction);
		setIsSplitDialogOpen(true);
	};

	const handleCreateRuleFromTransaction = (transaction: Transaction) => {
		const description = transaction.description || "";
		const condition: UICondition = {
			field: "tx_desc",
			operator: "contains",
			currentInput: description,
			case_sensitive: false,
		};

		setRulePrefill({ ruleName: description, condition });
		setRuleDialogOpen(true);
	};

	const activeFilterCount = useMemo(() => {
		let count = 0;
		if (filters.startDate || filters.endDate) count++;
		if (filters.amountMin !== undefined || filters.amountMax !== undefined)
			count++;
		if (filters.direction !== undefined) count++;
		if (filters.categories && filters.categories.length > 0) count++;
		return count;
	}, [filters]);

	return (
		<PageContainer>
			<PageContent>
				<PageHeaderWithTitle title="test transactions" />

				{(createError || updateError || deleteError) && (
					<ErrorMessage className="mb-6">
						{createError?.message ||
							updateError?.message ||
							deleteError?.message}
					</ErrorMessage>
				)}

				<div className="flex flex-col xl:flex-row xl:gap-8 gap-4">
					{/* Top toolbar - visible on all screens */}
					<div className="xl:hidden">
						<VStack spacing="sm">
							<HStack spacing="sm" justify="between">
								<div className="relative flex-1">
									<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										placeholder="search"
										className="pl-9 border border-border rounded-sm"
										value={searchInput}
										onChange={(e) => setSearchInput(e.target.value)}
									/>
								</div>
								<HStack spacing="xs">
									<Button
										onClick={() => refetch()}
										size="icon"
										variant="ghost"
										disabled={isLoading}
									>
										<RefreshCw
											className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
										/>
									</Button>
									<Button
										onClick={() => setIsDialogOpen(true)}
										size="icon"
										disabled={isCreating || isUpdating}
									>
										<Plus className="h-4 w-4" />
									</Button>
								</HStack>
							</HStack>
							<Button
								variant="outline"
								size="sm"
								className="w-full rounded-sm relative"
								onClick={() => setIsFiltersOpen(!isFiltersOpen)}
							>
								filters
								{activeFilterCount > 0 && (
									<Badge
										variant="default"
										className="ml-2 h-5 min-w-5 px-1.5 text-[10px]"
									>
										{activeFilterCount}
									</Badge>
								)}
							</Button>
						</VStack>
						<TransactionFiltersPanel
							filters={filters}
							onFiltersChange={setFilters}
							isOpen={isFiltersOpen}
						/>
					</div>

					<div className="flex-1 min-w-0 xl:order-2">
						<TransactionList
							searchQuery={debouncedSearchQuery}
							filters={filters}
							onSelectionChange={handleSelectionChange}
							onEditTransaction={handleEditTransaction}
							onDeleteTransaction={handleDeleteTransaction}
							onViewDetails={handleViewDetails}
							onSplitTransaction={handleSplitTransaction}
							onCreateRule={handleCreateRuleFromTransaction}
						/>
					</div>

					{/* Sidebar - visible on xl and up */}
					<aside className="hidden xl:block xl:flex-shrink-0 xl:sticky xl:top-8 xl:h-fit xl:w-80 xl:order-1">
						<VStack spacing="md">
							<HStack spacing="sm" justify="end">
								<Button
									onClick={() => refetch()}
									size="icon"
									variant="ghost"
									disabled={isLoading}
								>
									<RefreshCw
										className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
									/>
								</Button>
								<Button
									onClick={() => setIsDialogOpen(true)}
									size="default"
									disabled={isCreating || isUpdating}
								>
									<Plus className="h-4 w-4" />
									new
								</Button>
							</HStack>

							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="search"
									className="pl-9 border border-border rounded-sm"
									value={searchInput}
									onChange={(e) => setSearchInput(e.target.value)}
								/>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="w-full rounded-sm relative"
								onClick={() => setIsFiltersOpen(!isFiltersOpen)}
							>
								filters
								{activeFilterCount > 0 && (
									<Badge
										variant="default"
										className="ml-2 h-5 min-w-5 px-1.5 text-[10px]"
									>
										{activeFilterCount}
									</Badge>
								)}
							</Button>

							<TransactionFiltersPanel
								filters={filters}
								onFiltersChange={setFilters}
								isOpen={isFiltersOpen}
							/>

							{selectedTransactions.length > 0 && (
								<TransactionSidebar
									transactions={selectedTransactions}
									onClose={handleClearSelection}
									onDeleteSelected={handleDeleteSelected}
									onBulkModify={handleBulkModify}
								/>
							)}
						</VStack>
					</aside>
				</div>

				<TransactionDialog
					open={isDialogOpen}
					onOpenChange={handleDialogOpenChange}
					transaction={editingTransaction}
					onSave={handleSaveTransaction}
					title={editingTransaction ? "edit transaction" : "create transaction"}
				/>

				<Dialog
					open={isDetailsDialogOpen}
					onOpenChange={setIsDetailsDialogOpen}
				>
					<DialogContent className="max-w-lg">
						<DialogHeader>
							<DialogTitle>transaction details</DialogTitle>
						</DialogHeader>
						{detailsTransaction && (
							<TransactionDetailsDialog transaction={detailsTransaction} />
						)}
					</DialogContent>
				</Dialog>

				<SplitTransactionDialog
					transaction={splitTransaction}
					open={isSplitDialogOpen}
					onOpenChange={(open) => {
						setIsSplitDialogOpen(open);
						if (!open) setSplitTransaction(null);
					}}
				/>

				<RuleDialog
					isOpen={ruleDialogOpen}
					onClose={() => {
						setRuleDialogOpen(false);
						setRulePrefill(null);
						resetCreateRule();
					}}
					onSubmit={(ruleData) => {
						createRule(ruleData, {
							onSuccess: () => {
								setRuleDialogOpen(false);
								setRulePrefill(null);
							},
						});
					}}
					categories={categories}
					prefill={rulePrefill}
					title="create rule"
					submitText="create rule"
					isLoading={isCreatingRule}
					error={createRuleError?.message}
				/>
			</PageContent>
		</PageContainer>
	);
}
