import { create } from "@bufbuild/protobuf";
import {
	LinkTransferRequestSchema,
	ListTransferSuggestionsRequestSchema,
	UnlinkTransferRequestSchema,
} from "@/gen/nagomi/v1/transaction_services_pb";
import { transactionClient } from "@/lib/grpc-client";

export const transfersApi = {
	async link(userId: string, outgoingId: bigint, incomingId: bigint) {
		await transactionClient.linkTransfer(
			create(LinkTransferRequestSchema, { userId, outgoingId, incomingId }),
		);
	},

	// without a counterpart, unlinks the transaction's transfer
	async reject(userId: string, transactionId: bigint, counterpartId?: bigint) {
		await transactionClient.unlinkTransfer(
			create(UnlinkTransferRequestSchema, {
				userId,
				transactionId,
				counterpartId,
			}),
		);
	},

	async suggestions(userId: string) {
		const response = await transactionClient.listTransferSuggestions(
			create(ListTransferSuggestionsRequestSchema, { userId }),
		);
		return response.suggestions;
	},
};
