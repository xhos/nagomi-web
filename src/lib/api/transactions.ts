import { create } from "@bufbuild/protobuf";
import type { Cursor } from "@/gen/nagomi/v1/common_pb";
import type { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import {
	CreateTransactionRequestSchema,
	DeleteTransactionRequestSchema,
	ListTransactionsRequestSchema,
	UpdateTransactionRequestSchema,
} from "@/gen/nagomi/v1/transaction_services_pb";
import { transactionClient } from "@/lib/grpc-client";

export interface ListTransactionsInput {
	userId: string;
	limit?: number;
	accountId?: bigint;
	cursor?: Cursor;
	startDate?: Date;
	endDate?: Date;
	categories?: string[];
	categoryId?: bigint;
	includeUncategorized?: boolean;
	uncategorized?: boolean;
	direction?: TransactionDirection;
	merchantQuery?: string;
	descriptionQuery?: string;
	amountMin?: number;
	amountMax?: number;
}

export interface CreateTransactionInput {
	userId: string;
	accountId: bigint;
	txDate: Date;
	txAmount: {
		currencyCode: string;
		units: string;
		nanos: number;
	};
	direction: TransactionDirection;
	description?: string;
	merchant?: string;
	userNotes?: string;
	categoryId?: bigint;
}

export interface UpdateTransactionInput {
	userId: string;
	id: bigint;
	accountId?: bigint;
	txDate?: Date;
	txAmount?: {
		currencyCode: string;
		units: string;
		nanos: number;
	};
	direction?: TransactionDirection;
	description?: string;
	merchant?: string;
	userNotes?: string;
	// null clears the category; undefined leaves it untouched
	categoryId?: bigint | null;
}

const maskFor: [keyof UpdateTransactionInput, string][] = [
	["accountId", "account_id"],
	["txDate", "tx_date"],
	["txAmount", "tx_amount"],
	["direction", "direction"],
	["description", "description"],
	["merchant", "merchant"],
	["userNotes", "user_notes"],
	["categoryId", "category_id"],
];

export const transactionsApi = {
	async list(data: ListTransactionsInput) {
		const request = create(ListTransactionsRequestSchema, {
			userId: data.userId,
			limit: data.limit || 50,
			accountId: data.accountId,
			cursor: data.cursor,
			startDate: data.startDate
				? { seconds: BigInt(Math.floor(data.startDate.getTime() / 1000)) }
				: undefined,
			endDate: data.endDate
				? { seconds: BigInt(Math.floor(data.endDate.getTime() / 1000)) }
				: undefined,
			categories: data.categories,
			uncategorized: data.uncategorized,
			direction: data.direction,
			merchantQuery: data.merchantQuery,
			descriptionQuery: data.descriptionQuery,
			amountMin:
				data.amountMin !== undefined
					? {
							units: BigInt(Math.floor(data.amountMin)),
							nanos: Math.floor((data.amountMin % 1) * 1e9),
						}
					: undefined,
			amountMax:
				data.amountMax !== undefined
					? {
							units: BigInt(Math.floor(data.amountMax)),
							nanos: Math.floor((data.amountMax % 1) * 1e9),
						}
					: undefined,
		});
		const response = await transactionClient.listTransactions(request);
		return {
			transactions: response.transactions,
			totalCount: Number(response.totalCount),
			nextCursor: response.nextCursor,
			hasMore: !!response.nextCursor && response.transactions.length > 0,
		};
	},

	async create(data: CreateTransactionInput) {
		const request = create(CreateTransactionRequestSchema, {
			userId: data.userId,
			transactions: [
				{
					accountId: data.accountId,
					txDate: { seconds: BigInt(Math.floor(data.txDate.getTime() / 1000)) },
					txAmount: {
						currencyCode: data.txAmount.currencyCode,
						units: BigInt(data.txAmount.units),
						nanos: data.txAmount.nanos,
					},
					direction: data.direction,
					description: data.description,
					merchant: data.merchant,
					userNotes: data.userNotes,
					categoryId: data.categoryId,
				},
			],
		});
		const response = await transactionClient.createTransaction(request);
		return response.transactions[0];
	},

	async update(data: UpdateTransactionInput) {
		const request = create(UpdateTransactionRequestSchema, {
			userId: data.userId,
			id: data.id,
			updateMask: {
				paths: maskFor
					.filter(([key]) => data[key] !== undefined)
					.map(([, path]) => path),
			},
			accountId: data.accountId,
			txDate: data.txDate
				? { seconds: BigInt(Math.floor(data.txDate.getTime() / 1000)) }
				: undefined,
			txAmount: data.txAmount
				? {
						currencyCode: data.txAmount.currencyCode,
						units: BigInt(data.txAmount.units),
						nanos: data.txAmount.nanos,
					}
				: undefined,
			direction: data.direction,
			description: data.description,
			merchant: data.merchant,
			userNotes: data.userNotes,
			categoryId: data.categoryId ?? undefined,
		});
		await transactionClient.updateTransaction(request);
	},

	async bulkCreate(
		userId: string,
		transactions: Omit<CreateTransactionInput, "userId">[],
	) {
		const request = create(CreateTransactionRequestSchema, {
			userId,
			transactions: transactions.map((tx) => ({
				accountId: tx.accountId,
				txDate: { seconds: BigInt(Math.floor(tx.txDate.getTime() / 1000)) },
				txAmount: {
					currencyCode: tx.txAmount.currencyCode,
					units: BigInt(tx.txAmount.units),
					nanos: tx.txAmount.nanos,
				},
				direction: tx.direction,
				description: tx.description,
				merchant: tx.merchant,
				userNotes: tx.userNotes,
				categoryId: tx.categoryId,
			})),
		});
		const response = await transactionClient.createTransaction(request);
		return {
			transactions: response.transactions,
			createdCount: response.createdCount,
		};
	},

	async bulkDelete(userId: string, transactionIds: bigint[]) {
		const request = create(DeleteTransactionRequestSchema, {
			userId,
			ids: transactionIds,
		});
		await transactionClient.deleteTransaction(request);
	},
};
