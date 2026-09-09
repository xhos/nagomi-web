"use client";

import {
	Edit,
	MoreHorizontal,
	Plus,
	Search,
	Target,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { HStack, VStack } from "@/components/lib";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Category } from "@/gen/nagomi/v1/category_pb";
import type { Rule } from "@/gen/nagomi/v1/rule_pb";
import type { TransactionRule } from "@/lib/rules";

interface RulesTableProps {
	rules: Rule[];
	categories: Record<string, Category>;
	onEditRule: (rule: Rule) => void;
	onDeleteRule: (rule: Rule) => void;
	onToggleActive: (rule: Rule) => void;
	onCreateNew: () => void;
	isLoading: boolean;
}

export function RulesTable({
	rules,
	categories,
	onEditRule,
	onDeleteRule,
	onToggleActive,
	onCreateNew,
	isLoading,
}: RulesTableProps) {
	const [searchValue, setSearchValue] = useState("");

	const getCategoryName = (categoryId: bigint | undefined) => {
		if (!categoryId) return "Uncategorized";
		const category = categories[categoryId.toString()];
		return category ? category.slug : `Unknown (${categoryId})`;
	};

	const filteredRules = rules.filter((rule) => {
		if (!searchValue) return true;

		const searchLower = searchValue.toLowerCase();
		const nameMatches = rule.ruleName.toLowerCase().includes(searchLower);
		const categoryName = getCategoryName(rule.categoryId).toLowerCase();
		const categoryMatches = categoryName.includes(searchLower);

		return nameMatches || categoryMatches;
	});

	const formatConditionsPreview = (conditions: unknown): string => {
		if (!conditions || typeof conditions !== "object") return "";

		try {
			// Try new format first
			const rule = conditions as TransactionRule;
			if (rule.logic && rule.conditions && Array.isArray(rule.conditions)) {
				const condition = rule.conditions[0];
				if (condition) {
					let preview = `${condition.field} ${condition.operator}`;

					if ("value" in condition && condition.value !== undefined) {
						preview += ` "${condition.value}"`;
					} else if ("values" in condition && condition.values) {
						preview += ` [${condition.values.join(", ")}]`;
					} else if ("min_value" in condition && "max_value" in condition) {
						preview += ` ${condition.min_value}-${condition.max_value}`;
					}

					if (rule.conditions.length > 1) {
						preview += ` ${rule.logic} ...`;
					}

					return preview;
				}
			}

			// Fallback to old format
			const conditionsObj = conditions as Record<string, unknown>;
			if (
				conditionsObj.description &&
				typeof conditionsObj.description === "string"
			) {
				return conditionsObj.description;
			}

			if (conditionsObj.triggers && Array.isArray(conditionsObj.triggers)) {
				const trigger = conditionsObj.triggers[0];
				if (trigger) {
					return `${trigger.field} ${trigger.operator} "${trigger.value}"`;
				}
			}

			return "Custom conditions";
		} catch {
			return "Invalid conditions";
		}
	};

	return (
		<VStack spacing="md">
			<HStack spacing="md" justify="between" className="w-full">
				<div className="relative max-w-sm">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="search"
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
						className="pl-9"
					/>
				</div>
				<Button onClick={onCreateNew} disabled={isLoading}>
					<Plus className="h-4 w-4" />
					new
				</Button>
			</HStack>

			{rules.length === 0 ? (
				<VStack
					spacing="md"
					align="center"
					justify="center"
					className="border border-border rounded-lg p-8"
				>
					<Target className="text-2xl opacity-30 text-muted-foreground" />
					<p className="font-mono text-sm text-muted-foreground">
						no rules yet
					</p>
					<p className="font-mono text-xs text-muted-foreground/70">
						create your first rule to automatically categorize transactions
					</p>
				</VStack>
			) : filteredRules.length === 0 ? (
				<VStack
					spacing="sm"
					align="center"
					justify="center"
					className="border border-border rounded-lg p-8"
				>
					<Target className="text-2xl opacity-30 text-muted-foreground" />
					<p className="font-mono text-sm text-muted-foreground">
						no rules found matching &quot;{searchValue}&quot;
					</p>
				</VStack>
			) : (
				<div className="tui-border rounded-lg overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>name</TableHead>
								<TableHead>category</TableHead>
								<TableHead>conditions</TableHead>
								<TableHead>priority</TableHead>
								<TableHead>active</TableHead>
								<TableHead className="w-[50px]"></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredRules.map((rule, index) => (
								<TableRow
									key={rule.ruleId}
									className={
										index === filteredRules.length - 1 ? "border-b-0" : ""
									}
								>
									<TableCell className="font-mono text-sm">
										{rule.ruleName}
									</TableCell>
									<TableCell>
										<Badge variant="outline" className="font-mono text-xs">
											{getCategoryName(rule.categoryId)}
										</Badge>
									</TableCell>
									<TableCell className="max-w-[200px] truncate text-xs">
										{formatConditionsPreview(rule.conditions)}
									</TableCell>
									<TableCell className="text-sm">
										{rule.priorityOrder}
									</TableCell>
									<TableCell>
										<Switch
											checked={rule.isActive}
											onCheckedChange={() => onToggleActive(rule)}
											disabled={isLoading}
										/>
									</TableCell>
									<TableCell>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0"
												>
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem
													onClick={() => onEditRule(rule)}
													disabled={isLoading}
												>
													<Edit className="mr-2 h-4 w-4" />
													Edit
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => onDeleteRule(rule)}
													disabled={isLoading}
													className="text-destructive"
												>
													<Trash2 className="mr-2 h-4 w-4" />
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</VStack>
	);
}
