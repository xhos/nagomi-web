import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
	accountsApi,
	type CreateAccountInput,
	type SetAnchorBalanceInput,
	type UpdateAccountInput,
} from "@/lib/api/accounts";
import { transactionsApi } from "@/lib/api/transactions";
import { useUserId } from "./useSession";

export function useAccountHasTransactions(
	accountId: bigint | null | undefined,
) {
	const userId = useUserId();

	return useQuery({
		queryKey: ["accountHasTransactions", accountId?.toString()],
		queryFn: async () => {
			if (!userId || !accountId) return false;
			const result = await transactionsApi.list({
				userId,
				accountId,
				limit: 1,
			});
			return result.transactions.length > 0;
		},
		enabled: !!userId && !!accountId,
		staleTime: 60 * 1000,
	});
}

export function useAccounts() {
	const userId = useUserId();

	const {
		data: accounts = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["accounts", userId],
		queryFn: async () => {
			if (!userId) throw new Error("User not authenticated");
			return accountsApi.list(userId);
		},
		enabled: !!userId,
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	});

	const accountsMap = useMemo(() => {
		const map = new Map<string, { name: string; friendlyName?: string }>();
		accounts.forEach((account) => {
			map.set(account.id.toString(), {
				name: account.name,
				friendlyName: account.friendlyName,
			});
		});
		return map;
	}, [accounts]);

	const getAccountDisplayName = useCallback(
		(accountId: bigint, fallbackName?: string) => {
			const accountInfo = accountsMap.get(accountId.toString());
			if (accountInfo) {
				return accountInfo.friendlyName || accountInfo.name;
			}
			return fallbackName || `Account #${accountId}`;
		},
		[accountsMap],
	);

	const getAccountFullName = useCallback(
		(accountId: bigint, fallbackName?: string) => {
			const accountInfo = accountsMap.get(accountId.toString());
			if (accountInfo) {
				const parts = [];
				if (accountInfo.name) parts.push(accountInfo.name);
				if (accountInfo.friendlyName)
					parts.push(`(${accountInfo.friendlyName})`);
				return parts.join(" ") || `Account #${accountId}`;
			}
			return fallbackName || `Account #${accountId}`;
		},
		[accountsMap],
	);

	return {
		accounts,
		accountsMap,
		getAccountDisplayName,
		getAccountFullName,
		isLoading,
		error,
	};
}

export function useCreateAccount() {
	const userId = useUserId();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async (data: Omit<CreateAccountInput, "userId">) => {
			if (!userId) throw new Error("User not authenticated");
			return accountsApi.create({ ...data, userId });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["accounts"] });
			queryClient.invalidateQueries({ queryKey: ["transactions"] });
			queryClient.invalidateQueries({ queryKey: ["accountBalance"] });
		},
	});

	return {
		createAccount: mutation.mutate,
		createAccountAsync: mutation.mutateAsync,
		isPending: mutation.isPending,
		error: mutation.error,
	};
}

export function useUpdateAccount() {
	const userId = useUserId();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async (data: Omit<UpdateAccountInput, "userId">) => {
			if (!userId) throw new Error("User not authenticated");
			return accountsApi.update({ ...data, userId });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["accounts"] });
			// statement settings move missing and due periods
			queryClient.invalidateQueries({ queryKey: ["statements"] });
			queryClient.invalidateQueries({ queryKey: ["transactions"] });
			queryClient.invalidateQueries({ queryKey: ["accountBalance"] });
		},
	});

	return {
		updateAccount: mutation.mutate,
		updateAccountAsync: mutation.mutateAsync,
		isPending: mutation.isPending,
		error: mutation.error,
	};
}

export function useDeleteAccount() {
	const userId = useUserId();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async (id: bigint) => {
			if (!userId) throw new Error("User not authenticated");
			return accountsApi.delete(userId, id);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["accounts"] });
			queryClient.invalidateQueries({ queryKey: ["transactions"] });
			queryClient.invalidateQueries({ queryKey: ["accountBalance"] });
		},
	});

	return {
		deleteAccount: mutation.mutate,
		deleteAccountAsync: mutation.mutateAsync,
		isPending: mutation.isPending,
		error: mutation.error,
	};
}

export function useAddAccountAlias() {
	const userId = useUserId();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: ({
			accountId,
			alias,
		}: {
			accountId: bigint;
			alias: string;
		}) => {
			if (!userId) throw new Error("User not authenticated");
			return accountsApi.addAlias(userId, accountId, alias);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["accounts"] });
		},
	});

	return {
		addAlias: mutation.mutate,
		addAliasAsync: mutation.mutateAsync,
		isPending: mutation.isPending,
		error: mutation.error,
	};
}

export function useRemoveAccountAlias() {
	const userId = useUserId();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: ({
			accountId,
			alias,
		}: {
			accountId: bigint;
			alias: string;
		}) => {
			if (!userId) throw new Error("User not authenticated");
			return accountsApi.removeAlias(userId, accountId, alias);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["accounts"] });
		},
	});

	return {
		removeAlias: mutation.mutate,
		removeAliasAsync: mutation.mutateAsync,
		isPending: mutation.isPending,
		error: mutation.error,
	};
}

export function useSetAccountAliases() {
	const userId = useUserId();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: ({
			accountId,
			aliases,
		}: {
			accountId: bigint;
			aliases: string[];
		}) => {
			if (!userId) throw new Error("User not authenticated");
			return accountsApi.setAliases(userId, accountId, aliases);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["accounts"] });
		},
	});

	return {
		setAliases: mutation.mutate,
		setAliasesAsync: mutation.mutateAsync,
		isPending: mutation.isPending,
		error: mutation.error,
	};
}

export function useFindAccountByAlias() {
	return useCallback((alias: string) => accountsApi.findByAlias(alias), []);
}

export function useMergeAccounts() {
	const userId = useUserId();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async ({
			primaryAccountId,
			secondaryAccountId,
		}: {
			primaryAccountId: bigint;
			secondaryAccountId: bigint;
		}) => {
			if (!userId) throw new Error("User not authenticated");
			return accountsApi.mergeAccounts(
				userId,
				primaryAccountId,
				secondaryAccountId,
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["accounts"] });
			queryClient.invalidateQueries({ queryKey: ["transactions"] });
			queryClient.invalidateQueries({ queryKey: ["accountBalance"] });
		},
	});

	return {
		mergeAccounts: mutation.mutate,
		mergeAccountsAsync: mutation.mutateAsync,
		isPending: mutation.isPending,
		error: mutation.error,
	};
}

export function useSetAnchorBalance() {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async (data: SetAnchorBalanceInput) => {
			return accountsApi.setAnchorBalance(data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["accounts"] });
			queryClient.invalidateQueries({ queryKey: ["accountBalance"] });
		},
	});

	return {
		setAnchorBalance: mutation.mutate,
		setAnchorBalanceAsync: mutation.mutateAsync,
		isPending: mutation.isPending,
		error: mutation.error,
	};
}
