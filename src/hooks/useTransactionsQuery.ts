import {
	useInfiniteQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import type { TransactionFilters } from "@/app/transactions/components/TransactionFiltersDialog";
import type { Cursor } from "@/gen/nagomi/v1/common_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import {
	type CreateTransactionInput,
	transactionsApi,
	type UpdateTransactionInput,
} from "@/lib/api/transactions";
import { useUserId } from "./useSession";

interface UseTransactionsQueryOptions {
	accountId?: bigint;
	enabled?: boolean;
	searchQuery?: string;
	filters?: TransactionFilters;
}

export function useTransactionsQuery({
	accountId,
	enabled = true,
	searchQuery,
	filters,
}: UseTransactionsQueryOptions = {}) {
	const queryClient = useQueryClient();
	const userId = useUserId();

	// Infinite query for transactions with pagination
	const transactionsQuery = useInfiniteQuery({
		queryKey: ["transactions", accountId?.toString(), searchQuery, filters],
		queryFn: async ({ pageParam }) => {
			if (!userId) throw new Error("User not authenticated");
			return transactionsApi.list({
				userId,
				limit: 50,
				accountId,
				cursor: pageParam,
				descriptionQuery: searchQuery,
				startDate: filters?.startDate,
				endDate: filters?.endDate,
				direction: filters?.direction,
				categories: filters?.categories,
				amountMin: filters?.amountMin,
				amountMax: filters?.amountMax,
			});
		},
		getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
		enabled: enabled && !!userId,
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
		initialPageParam: undefined as Cursor | undefined,
	});

	// Flatten all pages into single transactions array
	const allTransactions = useMemo(() => {
		return (
			transactionsQuery.data?.pages.flatMap((page) => page.transactions) ?? []
		);
	}, [transactionsQuery.data]);

	const hasNextPage = transactionsQuery.hasNextPage;
	const isFetchingNextPage = transactionsQuery.isFetchingNextPage;

	// Optimistic delete mutation
	const deleteTransactionsMutation = useMutation({
		mutationFn: async (transactionIds: bigint[]) => {
			if (!userId) throw new Error("User not authenticated");
			return transactionsApi.bulkDelete(userId, transactionIds);
		},
		onMutate: async (transactionIds) => {
			await queryClient.cancelQueries({ queryKey: ["transactions"] });

			const idsToDelete = new Set(transactionIds.map((id) => id.toString()));

			queryClient.setQueriesData(
				{ queryKey: ["transactions"] },
				(
					old: { pages?: Array<{ transactions: Transaction[] }> } | undefined,
				) => {
					if (!old?.pages) return old;
					return {
						...old,
						pages: old.pages.map((page) => ({
							...page,
							transactions: page.transactions.filter(
								(t) => !idsToDelete.has(t.id.toString()),
							),
						})),
					};
				},
			);
		},
		onError: () => {
			queryClient.invalidateQueries({ queryKey: ["transactions"] });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transactions"] });
			queryClient.invalidateQueries({ queryKey: ["accounts"] });
			queryClient.invalidateQueries({ queryKey: ["transaction-summary"] });
		},
	});

	// Create transaction mutation
	const createTransactionMutation = useMutation({
		mutationFn: async (formData: Omit<CreateTransactionInput, "userId">) => {
			if (!userId) throw new Error("User not authenticated");
			return transactionsApi.create({ ...formData, userId });
		},
		onSuccess: () => {
			// Invalidate and refetch transactions
			queryClient.invalidateQueries({ queryKey: ["transactions"] });
			queryClient.invalidateQueries({ queryKey: ["accounts"] });
			queryClient.invalidateQueries({ queryKey: ["transaction-summary"] });
		},
	});

	// Update transaction mutation
	const updateTransactionMutation = useMutation({
		mutationFn: async (formData: Omit<UpdateTransactionInput, "userId">) => {
			if (!userId) throw new Error("User not authenticated");
			return transactionsApi.update({ ...formData, userId });
		},
		onSuccess: () => {
			// Invalidate and refetch transactions
			queryClient.invalidateQueries({ queryKey: ["transactions"] });
			queryClient.invalidateQueries({ queryKey: ["accounts"] });
			queryClient.invalidateQueries({ queryKey: ["transaction-summary"] });
		},
	});

	return {
		// Query state
		transactions: allTransactions,
		isLoading: transactionsQuery.isLoading,
		error: transactionsQuery.error,
		hasMore: hasNextPage,
		isLoadingMore: isFetchingNextPage,

		// Pagination
		loadMore: transactionsQuery.fetchNextPage,

		// Mutations
		deleteTransactions: deleteTransactionsMutation.mutate,
		isDeleting: deleteTransactionsMutation.isPending,
		deleteError: deleteTransactionsMutation.error,

		createTransaction: createTransactionMutation.mutateAsync,
		isCreating: createTransactionMutation.isPending,
		createError: createTransactionMutation.error,

		updateTransaction: updateTransactionMutation.mutateAsync,
		isUpdating: updateTransactionMutation.isPending,
		updateError: updateTransactionMutation.error,

		// Manual controls
		refetch: transactionsQuery.refetch,
		invalidate: () =>
			queryClient.invalidateQueries({
				queryKey: ["transactions", accountId?.toString()],
			}),
	};
}
