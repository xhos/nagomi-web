import { AccountType } from "@/gen/nagomi/v1/enums_pb";

export const ACCOUNT_TYPES: [AccountType, string, string][] = [
	[AccountType.ACCOUNT_CHEQUING, "chequing", "chequing"],
	[AccountType.ACCOUNT_SAVINGS, "savings", "savings"],
	[AccountType.ACCOUNT_CREDIT_CARD, "credit card", "credit cards"],
	[AccountType.ACCOUNT_INVESTMENT, "investment", "investments"],
	[AccountType.ACCOUNT_OTHER, "other", "other"],
	[AccountType.ACCOUNT_FRIEND, "friend", "friends"],
];

export const accountTypeName = (type: AccountType) =>
	ACCOUNT_TYPES.find(([t]) => t === type)?.[1] ?? "account";

export const accountTypePlural = (type: AccountType) =>
	ACCOUNT_TYPES.find(([t]) => t === type)?.[2] ?? "accounts";
