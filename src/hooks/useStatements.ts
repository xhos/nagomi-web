import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { statementsApi } from "@/lib/api/statements";
import { useUserId } from "./useSession";

export function useStatements(accountId: bigint, enabled = true) {
	const userId = useUserId();

	return useQuery({
		queryKey: ["statements", userId, accountId.toString()],
		queryFn: () => {
			if (!userId) throw new Error("User not authenticated");
			return statementsApi.list(userId, accountId);
		},
		enabled: enabled && !!userId,
		staleTime: 60 * 1000,
	});
}

export function useStatementCoverage(accountId: bigint, enabled = true) {
	const userId = useUserId();

	return useQuery({
		queryKey: ["statements", userId, "coverage", accountId.toString()],
		queryFn: () => {
			if (!userId) throw new Error("User not authenticated");
			return statementsApi.coverage(userId, accountId);
		},
		enabled: enabled && !!userId,
		staleTime: 60 * 1000,
	});
}

export function useStatementAlerts() {
	const userId = useUserId();

	return useQuery({
		queryKey: ["statements", userId, "alerts"],
		queryFn: () => {
			if (!userId) throw new Error("User not authenticated");
			return statementsApi.alerts(userId);
		},
		enabled: !!userId,
		staleTime: 60 * 1000,
	});
}

// everything a statement import or delete can change
export function useInvalidateStatementData() {
	const queryClient = useQueryClient();
	return () => {
		for (const key of [
			"statements",
			"accounts",
			"accountBalance",
			"transactions",
			"transaction-summary",
		])
			queryClient.invalidateQueries({ queryKey: [key] });
	};
}

export function useDeleteStatement() {
	const userId = useUserId();
	const invalidate = useInvalidateStatementData();

	return useMutation({
		mutationFn: ({
			id,
			deleteTransactions,
		}: {
			id: bigint;
			deleteTransactions: boolean;
		}) => {
			if (!userId) throw new Error("User not authenticated");
			return statementsApi.delete(userId, id, deleteTransactions);
		},
		onSuccess: invalidate,
	});
}
