"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { CategoryDialog } from "@/app/categories/category-dialog";
import { Button } from "@/components/ui/button";
import { CategoryPicker } from "@/components/ui/category-picker";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/forms";
import { Input } from "@/components/ui/input";
import type { Category } from "@/gen/nagomi/v1/category_pb";
import type { Rule } from "@/gen/nagomi/v1/rule_pb";
import { useCreateCategory } from "@/hooks/useCategories";
import {
	createRuleBuilder,
	type FieldName,
	NUMERIC_FIELDS,
	type NumericOperator,
	STRING_FIELDS,
	type StringOperator,
	type TransactionRule,
	validateRule,
} from "@/lib/rules";
import { cn } from "@/lib/utils";
import { ConditionBuilder, type UICondition } from "./ConditionBuilder";

interface RuleDialogPrefill {
	ruleName: string;
	condition: UICondition;
}

interface RuleDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (ruleData: {
		ruleName: string;
		categoryId?: bigint;
		merchant?: string;
		conditions: TransactionRule;
		isActive: boolean;
		priorityOrder: number;
		applyToExisting: boolean;
	}) => void;
	categories: Category[];
	rule?: Rule | null;
	prefill?: RuleDialogPrefill | null;
	title: string;
	submitText: string;
	isLoading: boolean;
	error?: string;
}

const DEFAULT_CONDITION: UICondition = {
	field: "tx_desc",
	operator: "contains",
	value: "",
	case_sensitive: false,
};

export function RuleDialog({
	isOpen,
	onClose,
	onSubmit,
	categories,
	rule,
	prefill,
	title,
	submitText,
	isLoading,
	error: externalError,
}: RuleDialogProps) {
	const { createCategoryAsync } = useCreateCategory();
	const [ruleName, setRuleName] = useState("");
	const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
	const [merchantValue, setMerchantValue] = useState("");
	const [logic, setLogic] = useState<"AND" | "OR">("AND");
	const [uiConditions, setUIConditions] = useState<UICondition[]>([
		DEFAULT_CONDITION,
	]);
	const [priorityOrder, setPriorityOrder] = useState(1);
	const [applyToExisting, setApplyToExisting] = useState(false);
	const [validationError, setValidationError] = useState<string | null>(null);
	const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
	const [pendingCategorySlug, setPendingCategorySlug] = useState<string | null>(
		null,
	);

	useEffect(() => {
		if (!pendingCategorySlug) return;
		const match = categories.find((c) => c.slug === pendingCategorySlug);
		if (match) {
			setSelectedCategoryId(match.id.toString());
			setPendingCategorySlug(null);
		}
	}, [categories, pendingCategorySlug]);

	useEffect(() => {
		if (!isOpen) return;

		setValidationError(null);

		if (rule) {
			setRuleName(rule.ruleName);
			setSelectedCategoryId(rule.categoryId?.toString() ?? "");
			setMerchantValue(rule.merchant ?? "");
			setPriorityOrder(rule.priorityOrder);

			try {
				const existingRule = rule.conditions as unknown as TransactionRule;
				if (existingRule?.logic && existingRule?.conditions) {
					setLogic(existingRule.logic);
					const uiConds: UICondition[] = existingRule.conditions.map(
						(condition) => {
							const uiCondition: UICondition = {
								field: condition.field,
								operator: condition.operator,
								case_sensitive:
									"case_sensitive" in condition
										? condition.case_sensitive
										: false,
							};

							if ("value" in condition && condition.value !== undefined) {
								uiCondition.value = condition.value;
							}
							if (
								"values" in condition &&
								condition.values &&
								Array.isArray(condition.values)
							) {
								uiCondition.values = condition.values;
								uiCondition.chips = condition.values;
							}
							if (
								"min_value" in condition &&
								condition.min_value !== undefined
							) {
								uiCondition.min_value = condition.min_value;
							}
							if (
								"max_value" in condition &&
								condition.max_value !== undefined
							) {
								uiCondition.max_value = condition.max_value;
							}
							return uiCondition;
						},
					);
					setUIConditions(uiConds);
				} else {
					setLogic("AND");
					setUIConditions([DEFAULT_CONDITION]);
				}
			} catch {
				setLogic("AND");
				setUIConditions([DEFAULT_CONDITION]);
			}
		} else if (prefill) {
			setRuleName(prefill.ruleName);
			setSelectedCategoryId("");
			setMerchantValue("");
			setLogic("AND");
			setUIConditions([
				{
					...prefill.condition,
					value: prefill.condition.value ?? prefill.condition.currentInput,
					currentInput: "",
				},
			]);
			setPriorityOrder(1);
			setApplyToExisting(true);
		} else {
			setRuleName("");
			setSelectedCategoryId("");
			setMerchantValue("");
			setLogic("AND");
			setUIConditions([DEFAULT_CONDITION]);
			setPriorityOrder(1);
			setApplyToExisting(false);
		}
	}, [isOpen, rule, prefill]);

	const addCondition = () =>
		setUIConditions((prev) => [...prev, { ...DEFAULT_CONDITION }]);
	const removeCondition = (index: number) =>
		setUIConditions((prev) => prev.filter((_, i) => i !== index));
	const updateCondition = (index: number, updates: Partial<UICondition>) =>
		setUIConditions((prev) =>
			prev.map((condition, i) =>
				i === index ? { ...condition, ...updates } : condition,
			),
		);

	const isValidCondition = (condition: UICondition): boolean => {
		if (condition.chips && condition.chips.length > 0) return true;
		if (condition.operator === "between") {
			return (
				condition.min_value !== undefined && condition.max_value !== undefined
			);
		}
		if (condition.field === "tx_direction") {
			return condition.value !== undefined;
		}
		if (NUMERIC_FIELDS.includes(condition.field)) {
			return (
				condition.value !== undefined &&
				condition.value !== "" &&
				!Number.isNaN(Number(condition.value))
			);
		}
		return condition.value !== undefined && condition.value !== "";
	};

	const canSubmit =
		ruleName.trim() !== "" &&
		uiConditions.some(isValidCondition) &&
		(selectedCategoryId !== "" || merchantValue.trim() !== "");

	const handleSubmit = () => {
		const builder = createRuleBuilder(logic);
		const validConditions = uiConditions.filter(isValidCondition);

		validConditions.forEach((condition) => {
			const isStringField = STRING_FIELDS.includes(condition.field);

			if (isStringField) {
				if (condition.chips && condition.chips.length > 0) {
					builder.addStringCondition(
						condition.field as Extract<
							FieldName,
							| "merchant"
							| "tx_desc"
							| "account_type"
							| "account_name"
							| "bank"
							| "currency"
						>,
						"contains_any" as StringOperator,
						undefined,
						{
							values: condition.chips,
							case_sensitive: condition.case_sensitive,
						},
					);
				} else {
					builder.addStringCondition(
						condition.field as Extract<
							FieldName,
							| "merchant"
							| "tx_desc"
							| "account_type"
							| "account_name"
							| "bank"
							| "currency"
						>,
						condition.operator as StringOperator,
						condition.value as string,
						{ case_sensitive: condition.case_sensitive },
					);
				}
			} else if (NUMERIC_FIELDS.includes(condition.field)) {
				if (condition.operator === "between") {
					builder.addNumericCondition(
						condition.field as Extract<FieldName, "amount" | "tx_direction">,
						condition.operator as NumericOperator,
						undefined,
						{ min_value: condition.min_value, max_value: condition.max_value },
					);
				} else {
					builder.addNumericCondition(
						condition.field as Extract<FieldName, "amount" | "tx_direction">,
						condition.operator as NumericOperator,
						condition.value as number,
					);
				}
			}
		});

		try {
			const transactionRule = builder.build();
			const validation = validateRule(transactionRule);

			if (!validation.isValid) {
				setValidationError(validation.errors[0].message);
				return;
			}

			setValidationError(null);
			onSubmit({
				ruleName,
				categoryId: selectedCategoryId ? BigInt(selectedCategoryId) : undefined,
				merchant: merchantValue || undefined,
				conditions: transactionRule,
				isActive: true,
				priorityOrder,
				applyToExisting,
			});
		} catch (err) {
			setValidationError(
				err instanceof Error ? err.message : "Unknown error occurred",
			);
		}
	};

	const selectedCategory = categories.find(
		(c) => c.id.toString() === selectedCategoryId,
	);
	const chip = (on: boolean) =>
		cn(
			"h-7 rounded-md border px-2.5 text-sm transition-colors",
			on ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
		);

	return (
		<>
			<CategoryDialog
				open={createCategoryOpen}
				onOpenChange={setCreateCategoryOpen}
				onSave={async (slug, color) => {
					await createCategoryAsync({ slug, color });
					setPendingCategorySlug(slug);
				}}
			/>
			<Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
				<DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
					</DialogHeader>

					<div className="-mx-1 flex-1 space-y-5 overflow-y-auto px-1">
						<Field label="Name" htmlFor="rule-name">
							<Input
								id="rule-name"
								value={ruleName}
								onChange={(e) => setRuleName(e.target.value)}
								placeholder="Groceries"
								autoFocus
							/>
						</Field>

						<div className="space-y-3 border-t pt-4">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className="text-sm font-medium">When</span>
								<span className="flex gap-2">
									<button
										type="button"
										className={chip(logic === "AND")}
										onClick={() => setLogic("AND")}
									>
										All conditions match
									</button>
									<button
										type="button"
										className={chip(logic === "OR")}
										onClick={() => setLogic("OR")}
									>
										Any condition matches
									</button>
								</span>
							</div>
							{uiConditions.map((condition, index) => (
								<ConditionBuilder
									key={index}
									condition={condition}
									showRemove={uiConditions.length > 1}
									onUpdate={(u) => updateCondition(index, u)}
									onRemove={() => removeCondition(index)}
								/>
							))}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={addCondition}
							>
								<Plus /> Add condition
							</Button>
						</div>

						<div className="space-y-3 border-t pt-4">
							<span className="text-sm font-medium">Then</span>
							<div className="grid gap-4 sm:grid-cols-2">
								<Field label="Set category">
									<CategoryPicker
										value={selectedCategory?.id}
										onChange={(c) =>
											setSelectedCategoryId(c?.id.toString() ?? "")
										}
									>
										<Button
											variant="outline"
											className="w-full justify-start font-normal"
										>
											{selectedCategory ? (
												<>
													<span
														className="size-2 rounded-full"
														style={{ backgroundColor: selectedCategory.color }}
													/>
													{selectedCategory.slug}
												</>
											) : (
												<span className="text-muted-foreground">
													Choose a category
												</span>
											)}
										</Button>
									</CategoryPicker>
									<Button
										type="button"
										variant="link"
										size="sm"
										className="h-auto p-0"
										onClick={() => setCreateCategoryOpen(true)}
									>
										New category
									</Button>
								</Field>
								<Field label="Set merchant" htmlFor="rule-merchant">
									<Input
										id="rule-merchant"
										value={merchantValue}
										onChange={(e) => setMerchantValue(e.target.value)}
										placeholder="Optional"
									/>
								</Field>
							</div>
						</div>

						<div className="flex flex-wrap items-end gap-6 border-t pt-4">
							<Field
								label="Priority"
								htmlFor="rule-priority"
								hint="Lower runs first."
							>
								<Input
									id="rule-priority"
									type="number"
									min={1}
									value={priorityOrder}
									onChange={(e) =>
										setPriorityOrder(Number(e.target.value) || 1)
									}
									className="w-24"
								/>
							</Field>
							{!rule && (
								<label className="flex items-center gap-2 pb-6 text-sm">
									<input
										type="checkbox"
										checked={applyToExisting}
										onChange={(e) => setApplyToExisting(e.target.checked)}
										className="size-3.5 accent-[var(--accent)]"
									/>
									Apply to existing transactions
								</label>
							)}
						</div>

						<FormError>{validationError || externalError}</FormError>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={onClose} disabled={isLoading}>
							Cancel
						</Button>
						<Button onClick={handleSubmit} disabled={isLoading || !canSubmit}>
							{isLoading ? "Saving…" : submitText}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
