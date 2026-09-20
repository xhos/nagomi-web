import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
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

	const receiptsQuery = useInfiniteQuery({
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
		initialPageParam: 0,
		queryFn: async ({ pageParam }) => {
			if (!userId) throw new Error("User not authenticated");
			return receiptsApi.list({
				userId,
				offset: pageParam,
				query,
				minTotalCents,
				maxTotalCents,
				status,
				unlinkedOnly,
				currency,
			});
		},
		getNextPageParam: (last, pages) => {
			const loaded = pages.reduce((n, p) => n + p.receipts.length, 0);
			return last.receipts.length && BigInt(loaded) < last.totalCount
				? loaded
				: undefined;
		},
		enabled: enabled && !!userId,
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
		refetchInterval: (query) => {
			const data = query.state.data;
			const hasPendingReceipts = data?.pages.some((p) =>
				p.receipts.some((r) => r.status === ReceiptStatus.PENDING),
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
		receipts: receiptsQuery.data?.pages.flatMap((p) => p.receipts) ?? [],
		totalCount: receiptsQuery.data?.pages[0]?.totalCount ?? BigInt(0),
		hasMore: receiptsQuery.hasNextPage,
		loadMore: receiptsQuery.fetchNextPage,
		isLoadingMore: receiptsQuery.isFetchingNextPage,
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

export function useUnlinkedReceiptCount() {
	const userId = useUserId();
	return useQuery({
		queryKey: ["receipts", "unlinked-count", userId],
		enabled: !!userId,
		queryFn: async () => {
			if (!userId) throw new Error("User not authenticated");
			const pages = await Promise.all(
				[ReceiptStatus.PENDING, ReceiptStatus.PARSED].map((status) =>
					receiptsApi.list({ userId, unlinkedOnly: true, status, limit: 1 }),
				),
			);
			return pages.reduce((n, p) => n + Number(p.totalCount), 0);
		},
		refetchInterval: 30_000,
	});
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
