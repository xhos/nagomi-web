import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { transfersApi } from "@/lib/api/transfers";
import { useUserId } from "./useSession";

export function useTransferSuggestions() {
	const userId = useUserId();
	return useQuery({
		queryKey: ["transactions", "transfer-suggestions", userId],
		queryFn: async () => {
			if (!userId) throw new Error("User not authenticated");
			return transfersApi.suggestions(userId);
		},
		enabled: !!userId,
		staleTime: 60 * 1000,
	});
}

// linking and unlinking change totals, so everything built on transactions refreshes
function useTransferMutation<T>(
	fn: (userId: string, input: T) => Promise<void>,
) {
	const userId = useUserId();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: T) => {
			if (!userId) throw new Error("User not authenticated");
			return fn(userId, input);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transactions"] });
		},
	});
}

export function useLinkTransfer() {
	return useTransferMutation(
		(
			userId,
			{ outgoingId, incomingId }: { outgoingId: bigint; incomingId: bigint },
		) => transfersApi.link(userId, outgoingId, incomingId),
	);
}

export function useRejectTransfer() {
	return useTransferMutation(
		(
			userId,
			{
				transactionId,
				counterpartId,
			}: { transactionId: bigint; counterpartId?: bigint },
		) => transfersApi.reject(userId, transactionId, counterpartId),
	);
}
