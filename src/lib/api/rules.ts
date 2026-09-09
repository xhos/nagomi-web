import { create, type JsonObject } from "@bufbuild/protobuf";
import {
	CreateRuleRequestSchema,
	DeleteRuleRequestSchema,
	ListRulesRequestSchema,
	UpdateRuleRequestSchema,
} from "@/gen/nagomi/v1/rule_services_pb";
import { ruleClient } from "@/lib/grpc-client";
import type { TransactionRule } from "@/lib/rules";

export interface CreateRuleInput {
	ruleName: string;
	categoryId?: bigint;
	merchant?: string;
	conditions: TransactionRule;
	applyToExisting: boolean;
}

export interface UpdateRuleInput {
	ruleName?: string;
	categoryId?: bigint;
	merchant?: string;
	conditions?: TransactionRule;
	isActive?: boolean;
	priorityOrder?: number;
}

const toJsonObject = (rule: TransactionRule): JsonObject =>
	rule as unknown as JsonObject;

export const rulesApi = {
	async list(userId: string) {
		const request = create(ListRulesRequestSchema, { userId });
		const response = await ruleClient.listRules(request);
		return response.rules;
	},

	async create(userId: string, data: CreateRuleInput) {
		const request = create(CreateRuleRequestSchema, {
			userId,
			ruleName: data.ruleName,
			categoryId: data.categoryId,
			merchant: data.merchant,
			conditions: toJsonObject(data.conditions),
			applyToExisting: data.applyToExisting,
		});

		const response = await ruleClient.createRule(request);
		return response.rule;
	},

	async update(userId: string, ruleId: string, data: UpdateRuleInput) {
		const updatePaths: string[] = [];
		if (data.ruleName !== undefined) updatePaths.push("rule_name");
		if (data.categoryId !== undefined) updatePaths.push("category_id");
		if (data.merchant !== undefined) updatePaths.push("merchant");
		if (data.conditions !== undefined) updatePaths.push("conditions");
		if (data.isActive !== undefined) updatePaths.push("is_active");
		if (data.priorityOrder !== undefined) updatePaths.push("priority_order");

		const { conditions, ...restData } = data;
		const request = create(UpdateRuleRequestSchema, {
			ruleId,
			userId,
			updateMask: { paths: updatePaths },
			...restData,
			...(conditions && { conditions: toJsonObject(conditions) }),
		});

		await ruleClient.updateRule(request);
	},

	async delete(userId: string, ruleId: string) {
		const request = create(DeleteRuleRequestSchema, { ruleId, userId });
		await ruleClient.deleteRule(request);
	},
};
