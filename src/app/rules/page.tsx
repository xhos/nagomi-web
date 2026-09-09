"use client";

import { useMemo, useState } from "react";
import { ErrorMessage, Muted } from "@/components/lib";
import {
	PageContainer,
	PageContent,
	PageHeaderWithTitle,
} from "@/components/ui/layout";
import type { Category } from "@/gen/nagomi/v1/category_pb";
import type { Rule } from "@/gen/nagomi/v1/rule_pb";
import { useCategories } from "@/hooks/useCategories";
import {
	useCreateRule,
	useDeleteRule,
	useRules,
	useUpdateRule,
} from "@/hooks/useRules";
import { useUserId } from "@/hooks/useSession";
import type { TransactionRule } from "@/lib/rules";
import { DeleteRuleDialog } from "./components/DeleteRuleDialog";
import { RuleDialog } from "./components/RuleDialog";
import { RulesTable } from "./components/RulesTable";

export default function RulesPage() {
	const userId = useUserId();

	const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null);

	const { rules, isLoading: rulesLoading, error: rulesError } = useRules();
	const { categories } = useCategories();

	const {
		createRule,
		isPending: isCreating,
		error: createError,
		reset: resetCreate,
	} = useCreateRule();

	const {
		updateRule,
		isPending: isUpdating,
		error: updateError,
		reset: resetUpdate,
	} = useUpdateRule();

	const { deleteRule, isPending: isDeleting } = useDeleteRule();

	const handleCreateRule = (ruleData: {
		ruleName: string;
		categoryId?: bigint;
		merchant?: string;
		conditions: TransactionRule;
		isActive: boolean;
		priorityOrder: number;
		applyToExisting: boolean;
	}) => {
		createRule(ruleData, {
			onSuccess: () => setIsCreateDialogOpen(false),
		});
	};

	const handleUpdateRule = (ruleData: {
		ruleName?: string;
		categoryId?: bigint;
		merchant?: string;
		conditions?: TransactionRule;
		isActive?: boolean;
		priorityOrder?: number;
	}) => {
		if (!selectedRule) return;
		updateRule(
			{ ruleId: selectedRule.ruleId, data: ruleData },
			{
				onSuccess: () => {
					setIsEditDialogOpen(false);
					setSelectedRule(null);
				},
			},
		);
	};

	const handleDeleteRule = () => {
		if (!ruleToDelete) return;
		deleteRule(ruleToDelete.ruleId, {
			onSuccess: () => setRuleToDelete(null),
		});
	};

	const handleEditRule = (rule: Rule) => {
		setSelectedRule(rule);
		setIsEditDialogOpen(true);
	};

	const handleToggleActiveRule = (rule: Rule) => {
		updateRule({
			ruleId: rule.ruleId,
			data: {
				ruleName: rule.ruleName,
				categoryId: rule.categoryId,
				merchant: rule.merchant,
				conditions: rule.conditions as unknown as TransactionRule,
				isActive: !rule.isActive,
				priorityOrder: rule.priorityOrder,
			},
		});
	};

	const isOperationLoading = isCreating || isUpdating || isDeleting;

	const categoriesMap = useMemo(() => {
		return categories.reduce(
			(acc, category) => {
				acc[category.id.toString()] = category;
				return acc;
			},
			{} as Record<string, Category>,
		);
	}, [categories]);

	if (!userId) {
		return (
			<PageContainer>
				<PageContent>
					<Muted size="sm">loading session...</Muted>
				</PageContent>
			</PageContainer>
		);
	}

	if (rulesLoading) {
		return (
			<PageContainer>
				<PageContent>
					<PageHeaderWithTitle title="rules" />
					<Muted size="sm">Loading rules...</Muted>
				</PageContent>
			</PageContainer>
		);
	}

	if (rulesError) {
		return (
			<PageContainer>
				<PageContent>
					<PageHeaderWithTitle title="rules" />
					<ErrorMessage>Error loading rules: {rulesError.message}</ErrorMessage>
				</PageContent>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageContent>
				<PageHeaderWithTitle title="rules" />

				<RulesTable
					rules={rules}
					categories={categoriesMap}
					onEditRule={handleEditRule}
					onDeleteRule={setRuleToDelete}
					onToggleActive={handleToggleActiveRule}
					onCreateNew={() => setIsCreateDialogOpen(true)}
					isLoading={isOperationLoading}
				/>

				<RuleDialog
					isOpen={isCreateDialogOpen}
					onClose={() => {
						setIsCreateDialogOpen(false);
						resetCreate();
					}}
					onSubmit={handleCreateRule}
					categories={categories}
					title="Create rule"
					submitText="Create rule"
					isLoading={isCreating}
					error={createError?.message}
				/>

				<RuleDialog
					isOpen={isEditDialogOpen}
					onClose={() => {
						setIsEditDialogOpen(false);
						setSelectedRule(null);
						resetUpdate();
					}}
					onSubmit={handleUpdateRule}
					categories={categories}
					rule={selectedRule}
					title="edit rule"
					submitText="update rule"
					isLoading={isUpdating}
					error={updateError?.message}
				/>

				<DeleteRuleDialog
					rule={ruleToDelete}
					onClose={() => setRuleToDelete(null)}
					onConfirm={handleDeleteRule}
					isLoading={isDeleting}
				/>
			</PageContent>
		</PageContainer>
	);
}
