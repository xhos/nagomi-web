"use client";

import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import type { UICondition } from "@/app/rules/components/ConditionBuilder";
import { RuleDialog } from "@/app/rules/components/RuleDialog";
import { Button } from "@/components/ui/button";
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
import {
	useTransactionsQuery,
	useUncategorizedCount,
} from "@/hooks/useTransactionsQuery";
import { cn } from "@/lib/utils";
import { SplitTransactionDialog } from "./components/SplitTransactionDialog";
import {
	countActiveFilters,
	type TransactionFilters,
	TransactionFiltersPanel,
} from "./components/TransactionFiltersPanel";
import { TransactionList } from "./components/TransactionList";
import { TransactionDialog } from "./components/transaction-dialog";

export default function TransactionsPage() {
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editing, setEditing] = useState<Transaction | null>(null);
	const [splitting, setSplitting] = useState<Transaction | null>(null);
	const [searchInput, setSearchInput] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [filters, setFilters] = useState<TransactionFilters>(() =>
		typeof window !== "undefined" &&
		new URLSearchParams(window.location.search).get("uncategorized") === "1"
			? { uncategorized: true }
			: {},
	);
	const [rulePrefill, setRulePrefill] = useState<{
		ruleName: string;
		condition: UICondition;
	} | null>(null);

	useEffect(() => {
		const t = setTimeout(() => setSearchQuery(searchInput), 300);
		return () => clearTimeout(t);
	}, [searchInput]);

	const { categories } = useCategories();
	const {
		createRule,
		isPending: isCreatingRule,
		error: createRuleError,
		reset: resetCreateRule,
	} = useCreateRule();
	const {
		deleteTransactions,
		createTransaction,
		updateTransaction,
		isCreating,
		isUpdating,
		createError,
		updateError,
		deleteError,
	} = useTransactionsQuery({});

	const { data: uncategorized = 0 } = useUncategorizedCount();

	const mutationError = createError || updateError || deleteError;
	const activeFilters = countActiveFilters(filters);

	const handleSave = async (formData: {
		accountId: bigint;
		txDate: Date;
		txAmount: { currencyCode: string; units: string; nanos: number };
		direction: TransactionDirection;
		description?: string;
		merchant?: string;
		userNotes?: string;
		categoryId?: bigint | null;
	}) => {
		if (editing) await updateTransaction({ id: editing.id, ...formData });
		else
			await createTransaction({
				...formData,
				categoryId: formData.categoryId ?? undefined,
			});
		setIsDialogOpen(false);
		setEditing(null);
	};

	const openCreate = () => {
		setEditing(null);
		setIsDialogOpen(true);
	};

	const openRuleFor = (tx: Transaction) => {
		const description = tx.description || "";
		setRulePrefill({
			ruleName: description,
			condition: {
				field: "tx_desc",
				operator: "contains",
				currentInput: description,
				case_sensitive: false,
			},
		});
	};

	return (
		<PageContainer>
			<PageContent>
				<PageHeaderWithTitle
					title="transactions"
					actions={
						<>
							{uncategorized > 0 && (
								<Button
									variant="outline"
									aria-pressed={!!filters.uncategorized}
									onClick={() =>
										setFilters((f) => ({
											...f,
											uncategorized: f.uncategorized ? undefined : true,
										}))
									}
									className={cn(
										filters.uncategorized &&
											"bg-foreground text-background hover:bg-foreground/90 hover:text-background",
									)}
								>
									<span className="tabular-nums">{uncategorized}</span>{" "}
									uncategorized
								</Button>
							)}
							<div className="relative">
								<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search"
									aria-label="Search transactions"
									className="w-40 pl-8 sm:w-56"
									value={searchInput}
									onChange={(e) => setSearchInput(e.target.value)}
								/>
							</div>
							<Button
								variant="outline"
								onClick={() => setFiltersOpen((o) => !o)}
								aria-expanded={filtersOpen}
								className={cn(filtersOpen && "bg-muted")}
							>
								<SlidersHorizontal />
								Filters
								{activeFilters > 0 && (
									<span className="rounded-md bg-foreground px-1.5 text-xs text-background tabular-nums">
										{activeFilters}
									</span>
								)}
							</Button>
							<Button onClick={openCreate} disabled={isCreating || isUpdating}>
								<Plus />
								New
							</Button>
						</>
					}
				/>

				{filtersOpen && (
					<TransactionFiltersPanel
						filters={filters}
						onFiltersChange={setFilters}
					/>
				)}

				{mutationError && (
					<p className="mb-4 text-sm text-destructive">
						{mutationError.message}
					</p>
				)}

				<TransactionList
					searchQuery={searchQuery}
					filters={filters}
					onCreate={openCreate}
					onDeleteMany={(txs) => deleteTransactions(txs.map((t) => t.id))}
					onEditTransaction={(tx) => {
						setEditing(tx);
						setIsDialogOpen(true);
					}}
					onDeleteTransaction={(tx) => deleteTransactions([tx.id])}
					onSplitTransaction={setSplitting}
					onCreateRule={openRuleFor}
				/>

				<TransactionDialog
					open={isDialogOpen}
					onOpenChange={(open) => {
						setIsDialogOpen(open);
						if (!open) setEditing(null);
					}}
					transaction={editing}
					onSave={handleSave}
					title={editing ? "edit transaction" : "new transaction"}
				/>

				<SplitTransactionDialog
					transaction={splitting}
					open={!!splitting}
					onOpenChange={(o) => !o && setSplitting(null)}
				/>

				<RuleDialog
					isOpen={!!rulePrefill}
					onClose={() => {
						setRulePrefill(null);
						resetCreateRule();
					}}
					onSubmit={(rule) =>
						createRule(rule, { onSuccess: () => setRulePrefill(null) })
					}
					categories={categories}
					prefill={rulePrefill}
					title="create rule"
					submitText="Create rule"
					isLoading={isCreatingRule}
					error={createRuleError?.message}
				/>
			</PageContent>
		</PageContainer>
	);
}
