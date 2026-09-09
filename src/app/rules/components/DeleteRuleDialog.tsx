"use client";

import { HStack, Muted, Text, VStack } from "@/components/lib";
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
import { Badge } from "@/components/ui/badge";
import type { Rule } from "@/gen/nagomi/v1/rule_pb";
import type { TransactionRule } from "@/lib/rules";

interface DeleteRuleDialogProps {
	rule: Rule | null;
	onClose: () => void;
	onConfirm: () => void;
	isLoading: boolean;
}

export function DeleteRuleDialog({
	rule,
	onClose,
	onConfirm,
	isLoading,
}: DeleteRuleDialogProps) {
	if (!rule) return null;

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
		<AlertDialog open={!!rule} onOpenChange={onClose}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>delete rule</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<VStack spacing="sm">
							<p>
								Are you sure you want to delete this rule? This action cannot be
								undone.
							</p>
							<VStack spacing="xs" className="p-3 tui-border rounded-lg">
								<HStack spacing="sm" justify="between">
									<Text size="sm" weight="medium">
										rule name:
									</Text>
									<Text size="sm" className="font-mono">
										{rule.ruleName}
									</Text>
								</HStack>
								<HStack spacing="sm" justify="between">
									<Text size="sm" weight="medium">
										Applied:
									</Text>
									<Text size="sm">{rule.timesApplied} times</Text>
								</HStack>
								<HStack spacing="sm" justify="between">
									<Text size="sm" weight="medium">
										Status:
									</Text>
									<Badge variant={rule.isActive ? "default" : "secondary"}>
										{rule.isActive ? "active" : "inactive"}
									</Badge>
								</HStack>
								<VStack spacing="xs">
									<Text size="sm" weight="medium">
										Conditions:
									</Text>
									<Muted size="xs">
										{formatConditionsPreview(rule.conditions)}
									</Muted>
								</VStack>
							</VStack>
						</VStack>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isLoading}>cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						disabled={isLoading}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{isLoading ? "deleting..." : "delete rule"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
