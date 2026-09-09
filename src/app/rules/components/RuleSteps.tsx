import { HelpCircle, Plus } from "lucide-react";
import { Card, HStack, Muted, Text, VStack } from "@/components/lib";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Category } from "@/gen/nagomi/v1/category_pb";
import { ConditionBuilder, type UICondition } from "./ConditionBuilder";
import { FIELD_OPTIONS, TX_DIRECTION_OPTIONS } from "./rule-dialog-constants";

function StepLayout({ children }: { children: React.ReactNode }) {
	return <div>{children}</div>;
}

interface Step1Props {
	ruleName: string;
	onRuleNameChange: (name: string) => void;
	onNext?: () => void;
}

export function Step1({ ruleName, onRuleNameChange, onNext }: Step1Props) {
	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && ruleName.trim() && onNext) {
			e.preventDefault();
			e.currentTarget.blur();
			requestAnimationFrame(() => {
				onNext();
				requestAnimationFrame(() => {
					const firstRadio = document.getElementById("all-conditions");
					firstRadio?.focus();
				});
			});
		}
	};

	return (
		<StepLayout>
			<VStack spacing="sm" align="start">
				<Label htmlFor="ruleName" className="text-base font-medium">
					name
				</Label>
				<Input
					id="ruleName"
					value={ruleName}
					onChange={(e) => onRuleNameChange(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="e.g., Groceries"
				/>
			</VStack>
		</StepLayout>
	);
}

interface Step2Props {
	logic: "AND" | "OR";
	conditions: UICondition[];
	onLogicChange: (logic: "AND" | "OR") => void;
	onUpdateCondition: (index: number, updates: Partial<UICondition>) => void;
	onRemoveCondition: (index: number) => void;
	onAddCondition: () => void;
	onNext?: () => void;
	canProceed?: boolean;
}

export function Step2({
	logic,
	conditions,
	onLogicChange,
	onUpdateCondition,
	onRemoveCondition,
	onAddCondition,
	onNext,
	canProceed,
}: Step2Props) {
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && canProceed && onNext && !isInputFocused()) {
			e.preventDefault();
			onNext();
		}
	};

	const isInputFocused = () => {
		const activeElement = document.activeElement;
		return (
			activeElement &&
			(activeElement.tagName === "INPUT" ||
				activeElement.tagName === "TEXTAREA" ||
				activeElement.getAttribute("contenteditable") === "true")
		);
	};

	return (
		<VStack spacing="md" onKeyDown={handleKeyDown} className="w-full">
			<Card variant="subtle" padding="md">
				<VStack spacing="sm" align="start">
					<Label className="text-base font-medium">Apply this rule when:</Label>
					<RadioGroup value={logic} onValueChange={onLogicChange}>
						<VStack spacing="sm" align="start">
							<HStack spacing="sm" align="start">
								<RadioGroupItem
									value="AND"
									id="all-conditions"
									className="mt-1"
								/>
								<VStack spacing="xs" align="start">
									<Label
										htmlFor="all-conditions"
										className="font-medium cursor-pointer"
									>
										ALL conditions are met
									</Label>
									<Muted size="xs">
										Transaction must match all conditions below
									</Muted>
								</VStack>
							</HStack>
							<HStack spacing="sm" align="start">
								<RadioGroupItem
									value="OR"
									id="any-conditions"
									className="mt-1"
								/>
								<VStack spacing="xs" align="start">
									<Label
										htmlFor="any-conditions"
										className="font-medium cursor-pointer"
									>
										ANY condition is met
									</Label>
									<Muted size="xs">
										Transaction matches any single condition below
									</Muted>
								</VStack>
							</HStack>
						</VStack>
					</RadioGroup>
				</VStack>
			</Card>

			{conditions.map((condition, index) => (
				<ConditionBuilder
					key={index}
					condition={condition}
					index={index}
					logic={logic}
					showRemove={conditions.length > 1}
					onUpdate={(updates) => onUpdateCondition(index, updates)}
					onRemove={() => onRemoveCondition(index)}
				/>
			))}

			<Button
				type="button"
				variant="outline"
				onClick={onAddCondition}
				className="w-full"
			>
				<Plus className="h-4 w-4 mr-2" />
				add another condition
			</Button>
		</VStack>
	);
}

interface Step3Props {
	selectedCategoryId: string;
	merchantValue: string;
	categories: Category[];
	onCategoryChange: (categoryId: string) => void;
	onMerchantChange: (merchant: string) => void;
	onOpenCreateCategory: () => void;
}

export function Step3({
	selectedCategoryId,
	merchantValue,
	categories,
	onCategoryChange,
	onMerchantChange,
	onOpenCreateCategory,
}: Step3Props) {
	return (
		<Card variant="subtle" padding="md">
			<HStack spacing="sm" align="center" className="flex-wrap">
				<Text size="sm">Apply category</Text>
				<Select
					value={selectedCategoryId}
					onValueChange={(value) => {
						if (value === "_create_new") {
							onOpenCreateCategory();
							return;
						}
						onCategoryChange(value);
					}}
				>
					<SelectTrigger className="w-48">
						<SelectValue placeholder="select" />
					</SelectTrigger>
					<SelectContent>
						{categories.map((category) => (
							<SelectItem
								key={category.id.toString()}
								value={category.id.toString()}
							>
								{category.slug}
							</SelectItem>
						))}
						<SelectItem value="_create_new" className="text-muted-foreground">
							+ new category
						</SelectItem>
					</SelectContent>
				</Select>

				<Muted size="sm">and/or</Muted>

				<Text size="sm">merchant</Text>
				<Input
					id="merchant"
					value={merchantValue}
					onChange={(e) => onMerchantChange(e.target.value)}
					placeholder="enter value"
					className="w-48"
				/>
			</HStack>
		</Card>
	);
}

interface Step4Props {
	ruleName: string;
	selectedCategoryId: string;
	merchantValue: string;
	categories: Category[];
	conditions: UICondition[];
	logic: "AND" | "OR";
	priorityOrder: number;
	applyToExisting: boolean;
	onPriorityChange: (priority: number) => void;
	onApplyToExistingChange: (apply: boolean) => void;
}

export function Step4({
	ruleName,
	selectedCategoryId,
	merchantValue,
	categories,
	conditions,
	logic,
	priorityOrder,
	applyToExisting,
	onPriorityChange,
	onApplyToExistingChange,
}: Step4Props) {
	const selectedCategory = categories.find(
		(c) => c.id.toString() === selectedCategoryId,
	);

	const validConditions = conditions.filter((condition) => {
		if (condition.chips && condition.chips.length > 0) return true;
		if (condition.operator === "contains_any") {
			return condition.values && condition.values.length > 0;
		}
		if (condition.operator === "between") {
			return (
				condition.min_value !== undefined && condition.max_value !== undefined
			);
		}
		return condition.value !== undefined && condition.value !== "";
	});

	return (
		<VStack spacing="md">
			<Card padding="md">
				<VStack spacing="md" align="start">
					<VStack spacing="xs" align="start">
						<Label className="text-xs text-muted-foreground">name</Label>
						<Text size="sm" weight="medium">
							{ruleName}
						</Text>
					</VStack>

					<VStack spacing="xs" align="start">
						<Label className="text-xs text-muted-foreground">when</Label>
						<VStack spacing="sm" align="start">
							{validConditions.map((condition, index) => (
								<Text key={index} size="sm">
									{index > 0 && (
										<span className="text-muted-foreground">{logic} </span>
									)}
									<span>
										{
											FIELD_OPTIONS.find((f) => f.value === condition.field)
												?.label
										}{" "}
										{condition.operator}{" "}
										{condition.chips && condition.chips.length > 0
											? `[${condition.chips.join(", ")}]`
											: condition.operator === "contains_any"
												? `[${condition.values?.join(", ")}]`
												: condition.operator === "between"
													? `${condition.min_value} - ${condition.max_value}`
													: condition.field === "tx_direction"
														? TX_DIRECTION_OPTIONS.find(
																(t) => t.value === condition.value,
															)?.label
														: `"${condition.value}"`}
										{condition.case_sensitive && " (case sensitive)"}
									</span>
								</Text>
							))}
						</VStack>
					</VStack>

					<VStack spacing="xs" align="start">
						<Label className="text-xs text-muted-foreground">apply</Label>
						<HStack spacing="sm" className="flex-wrap">
							{selectedCategory && (
								<HStack spacing="xs" align="center">
									<Text size="sm">category</Text>
									<Badge variant="outline">{selectedCategory.slug}</Badge>
								</HStack>
							)}
							{selectedCategory && merchantValue && (
								<Muted size="sm">and</Muted>
							)}
							{merchantValue && (
								<HStack spacing="xs" align="center">
									<Text size="sm">merchant</Text>
									<Badge variant="outline">{merchantValue}</Badge>
								</HStack>
							)}
						</HStack>
					</VStack>
				</VStack>
			</Card>

			<HStack
				spacing="lg"
				justify="between"
				align="center"
				className="w-full flex-wrap"
			>
				<HStack spacing="sm" align="center">
					<Label htmlFor="applyToExisting">Apply to existing</Label>
					<Switch
						id="applyToExisting"
						checked={applyToExisting}
						onCheckedChange={onApplyToExistingChange}
					/>
				</HStack>

				<HStack spacing="sm" align="center">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Label
									htmlFor="priority"
									className="flex items-center gap-1 cursor-help"
								>
									Priority
									<HelpCircle className="h-3 w-3 text-muted-foreground" />
								</Label>
							</TooltipTrigger>
							<TooltipContent>
								<p className="text-xs max-w-xs">
									Lower numbers have higher priority. If priorities match, rules
									are applied alphabetically by name.
								</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
					<Input
						id="priority"
						type="number"
						value={priorityOrder}
						onChange={(e) =>
							onPriorityChange(parseInt(e.target.value, 10) || 1)
						}
						min={1}
						className="w-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
					/>
				</HStack>
			</HStack>
		</VStack>
	);
}
