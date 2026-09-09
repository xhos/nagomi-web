import { create } from "@bufbuild/protobuf";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import type { FriendBalance } from "@/gen/nagomi/v1/transaction_services_pb";
import {
	ForgiveTransactionRequestSchema,
	GetFriendBalancesRequestSchema,
	SplitEntrySchema,
	SplitTransactionRequestSchema,
} from "@/gen/nagomi/v1/transaction_services_pb";
import { transactionClient } from "@/lib/grpc-client";

export type { FriendBalance };

export interface SplitEntryInput {
	friendAccountId: bigint;
	amount: {
		currencyCode: string;
		units: string;
		nanos: number;
	};
}

export const splitsApi = {
	async splitTransaction(
		userId: string,
		sourceTransactionId: bigint,
		splits: SplitEntryInput[],
	): Promise<Transaction[]> {
		const request = create(SplitTransactionRequestSchema, {
			userId,
			sourceTransactionId,
			splits: splits.map((s) =>
				create(SplitEntrySchema, {
					friendAccountId: s.friendAccountId,
					amount: {
						currencyCode: s.amount.currencyCode,
						units: BigInt(s.amount.units),
						nanos: s.amount.nanos,
					},
				}),
			),
		});
		const response = await transactionClient.splitTransaction(request);
		return response.createdSplits;
	},

	async forgiveTransaction(
		userId: string,
		transactionId: bigint,
		forgiven: boolean,
	): Promise<void> {
		const request = create(ForgiveTransactionRequestSchema, {
			userId,
			transactionId,
			forgiven,
		});
		await transactionClient.forgiveTransaction(request);
	},

	async getFriendBalances(userId: string): Promise<FriendBalance[]> {
		const request = create(GetFriendBalancesRequestSchema, { userId });
		const response = await transactionClient.getFriendBalances(request);
		return response.balances;
	},
};
