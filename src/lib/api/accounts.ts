import { create } from "@bufbuild/protobuf";
import {
	AddAccountAliasRequestSchema,
	CreateAccountRequestSchema,
	DeleteAccountRequestSchema,
	FindAccountByAliasRequestSchema,
	ListAccountsRequestSchema,
	MergeAccountsRequestSchema,
	RemoveAccountAliasRequestSchema,
	SetAccountAliasesRequestSchema,
	UpdateAccountRequestSchema,
} from "@/gen/nagomi/v1/account_services_pb";
import type { AccountType } from "@/gen/nagomi/v1/enums_pb";
import { accountClient } from "@/lib/grpc-client";

export interface CreateAccountInput {
	userId: string;
	name: string;
	bank: string;
	type: AccountType;
	friendlyName?: string;
	anchorBalance?: {
		currencyCode: string;
		units: string;
		nanos: number;
	};
	mainCurrency?: string;
	colors?: string[];
}

export interface UpdateAccountInput {
	userId: string;
	id: bigint;
	name: string;
	bank: string;
	accountType: AccountType;
	friendlyName?: string;
	mainCurrency?: string;
	colors?: string[];
}

export interface SetAnchorBalanceInput {
	userId: string;
	id: bigint;
	balance: {
		units: string;
		nanos: number;
	};
}

export const accountsApi = {
	async list(userId: string) {
		const request = create(ListAccountsRequestSchema, { userId });
		const response = await accountClient.listAccounts(request);
		return response.accounts;
	},

	async create(data: CreateAccountInput) {
		const request = create(CreateAccountRequestSchema, {
			userId: data.userId,
			name: data.name,
			bank: data.bank,
			type: data.type,
			friendlyName: data.friendlyName,
			anchorBalance: data.anchorBalance
				? {
						currencyCode: data.anchorBalance.currencyCode,
						units: BigInt(data.anchorBalance.units),
						nanos: data.anchorBalance.nanos,
					}
				: undefined,
			mainCurrency: data.mainCurrency,
			colors: data.colors,
		});
		const response = await accountClient.createAccount(request);
		return response.account;
	},

	async update(data: UpdateAccountInput) {
		const maskPaths = [
			"name",
			"bank",
			"account_type",
			"friendly_name",
			"colors",
		];
		if (data.mainCurrency !== undefined) maskPaths.push("main_currency");
		const request = create(UpdateAccountRequestSchema, {
			userId: data.userId,
			id: data.id,
			updateMask: { paths: maskPaths },
			name: data.name,
			bank: data.bank,
			accountType: data.accountType,
			friendlyName: data.friendlyName,
			mainCurrency: data.mainCurrency,
			colors: data.colors,
		});
		await accountClient.updateAccount(request);
	},

	async delete(userId: string, id: bigint) {
		const request = create(DeleteAccountRequestSchema, {
			userId,
			id,
		});
		await accountClient.deleteAccount(request);
	},

	async addAlias(userId: string, accountId: bigint, alias: string) {
		const request = create(AddAccountAliasRequestSchema, {
			userId,
			accountId,
			alias,
		});
		await accountClient.addAccountAlias(request);
	},

	async removeAlias(userId: string, accountId: bigint, alias: string) {
		const request = create(RemoveAccountAliasRequestSchema, {
			userId,
			accountId,
			alias,
		});
		await accountClient.removeAccountAlias(request);
	},

	async setAliases(userId: string, accountId: bigint, aliases: string[]) {
		const request = create(SetAccountAliasesRequestSchema, {
			userId,
			accountId,
			aliases,
		});
		await accountClient.setAccountAliases(request);
	},

	async findByAlias(alias: string) {
		const request = create(FindAccountByAliasRequestSchema, { alias });
		const response = await accountClient.findAccountByAlias(request);
		return response.account;
	},

	async mergeAccounts(
		userId: string,
		primaryAccountId: bigint,
		secondaryAccountId: bigint,
	) {
		const request = create(MergeAccountsRequestSchema, {
			userId,
			primaryAccountId,
			secondaryAccountId,
		});
		const response = await accountClient.mergeAccounts(request);
		return response;
	},

	async setAnchorBalance(data: SetAnchorBalanceInput) {
		const request = create(UpdateAccountRequestSchema, {
			userId: data.userId,
			id: data.id,
			updateMask: { paths: ["anchor_balance", "anchor_date"] },
			anchorBalance: {
				units: BigInt(data.balance.units),
				nanos: data.balance.nanos,
			},
			anchorDate: { seconds: BigInt(Math.floor(Date.now() / 1000)) },
		});
		await accountClient.updateAccount(request);
	},
};
