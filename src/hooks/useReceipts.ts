import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReceiptStatus } from "@/gen/nagomi/v1/receipt_pb";
import { receiptsApi } from "@/lib/api/receipts";
import { useUserId } from "./useSession";

export interface ReceiptFilters {
	query?: string;
	minTotalCents?: bigint;
	maxTotalCents?: bigint;
	status?: ReceiptStatus;
	unlinkedOnly?: boolean;
	currency?: string;
}

interface UseReceiptsOptions extends ReceiptFilters {
	enabled?: boolean;
}

export function useReceipts({
	enabled = true,
	query,
	minTotalCents,
	maxTotalCents,
	status,
	unlinkedOnly,
	currency,
}: UseReceiptsOptions = {}) {
	const queryClient = useQueryClient();
	const userId = useUserId();

	const receiptsQuery = useQuery({
		queryKey: [
			"receipts",
			userId,
			query,
			minTotalCents?.toString(),
			maxTotalCents?.toString(),
			status,
			unlinkedOnly,
			currency,
		],
		queryFn: async () => {
			if (!userId) throw new Error("User not authenticated");
			return receiptsApi.list({
				userId,
				query,
				minTotalCents,
				maxTotalCents,
				status,
				unlinkedOnly,
				currency,
			});
		},
		enabled: enabled && !!userId,
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
		refetchInterval: (query) => {
			const data = query.state.data;
			const hasPendingReceipts = data?.receipts.some(
				(r) => r.status === ReceiptStatus.PENDING,
			);
			return hasPendingReceipts ? 3000 : false;
		},
	});

	const deleteReceiptMutation = useMutation({
		mutationFn: async (receiptId: bigint) => {
			if (!userId) throw new Error("User not authenticated");
			return receiptsApi.delete(userId, receiptId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["receipts"] });
		},
	});

	const retryParseMutation = useMutation({
		mutationFn: async (receiptId: bigint) => {
			if (!userId) throw new Error("User not authenticated");
			return receiptsApi.retryParse(userId, receiptId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["receipts"] });
		},
	});

	return {
		receipts: receiptsQuery.data?.receipts ?? [],
		totalCount: receiptsQuery.data?.totalCount ?? BigInt(0),
		isLoading: receiptsQuery.isLoading,
		error: receiptsQuery.error,
		refetch: receiptsQuery.refetch,
		deleteReceipt: deleteReceiptMutation.mutate,
		isDeleting: deleteReceiptMutation.isPending,
		deleteError: deleteReceiptMutation.error,
		retryParse: retryParseMutation.mutate,
		isRetrying: retryParseMutation.isPending,
	};
}

export function useUser() {
	const userId = useUserId();
	return { user: userId ? { id: userId } : null };
}

export function useReceipt(receiptId: bigint | null) {
	const userId = useUserId();

	return useQuery({
		queryKey: ["receipt", userId, receiptId?.toString()],
		queryFn: async () => {
			if (!userId || !receiptId) throw new Error("Missing userId or receiptId");
			return receiptsApi.get(userId, receiptId);
		},
		enabled: !!userId && !!receiptId,
		staleTime: 60 * 1000,
	});
}

export function useLinkReceipt() {
	const queryClient = useQueryClient();
	const userId = useUserId();

	return useMutation({
		mutationFn: async ({
			receiptId,
			transactionId,
		}: {
			receiptId: bigint;
			transactionId: bigint;
		}) => {
			if (!userId) throw new Error("User not authenticated");
			return receiptsApi.linkToTransaction(userId, receiptId, transactionId);
		},
		onSuccess: (_, { receiptId }) => {
			queryClient.invalidateQueries({ queryKey: ["receipts"] });
			queryClient.invalidateQueries({
				queryKey: ["receipt", userId, receiptId.toString()],
			});
		},
	});
}
