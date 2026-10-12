import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import type { Category } from "@/gen/nagomi/v1/category_pb";
import {
	type CreateCategoryInput,
	categoriesApi,
	type UpdateCategoryColorInput,
	type UpdateCategoryInput,
} from "@/lib/api/categories";
import { useUserId } from "./useSession";

// transactions and rules embed or cascade from categories, so they go stale too
function invalidateCategoryUsers(queryClient: QueryClient) {
	for (const key of [
		"categories",
		"transactions",
		"transaction-summary",
		"rules",
	])
		queryClient.invalidateQueries({ queryKey: [key] });
}

export function useCategories() {
	const userId = useUserId();

	const {
		data: categories = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["categories", userId],
		queryFn: async () => {
			if (!userId) throw new Error("User not authenticated");
			return categoriesApi.list(userId);
		},
		enabled: !!userId,
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	});

	const categoryMap = useMemo(() => {
		const map = new Map<string, Category>();
		categories.forEach((cat) => {
			map.set(cat.id.toString(), cat);
		});
		return map;
	}, [categories]);

	const getCategoryById = (categoryId: bigint | string) => {
		return categoryMap.get(categoryId.toString());
	};

	return {
		categories,
		categoryMap,
		getCategoryById,
		isLoading,
		error,
	};
}

export function useCreateCategory() {
	const userId = useUserId();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async (data: CreateCategoryInput) => {
			return categoriesApi.create(data);
		},
		// show it in every picker at once, before the refetch lands
		onSuccess: (created) => {
			if (created)
				queryClient.setQueryData<Category[]>(["categories", userId], (old) =>
					old ? [...old, created] : old,
				);
			queryClient.invalidateQueries({ queryKey: ["categories", userId] });
		},
	});

	return {
		createCategory: mutation.mutate,
		createCategoryAsync: mutation.mutateAsync,
		isPending: mutation.isPending,
		error: mutation.error,
	};
}

export function useUpdateCategory() {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async (data: UpdateCategoryInput) => {
			return categoriesApi.update(data);
		},
		onSuccess: () => invalidateCategoryUsers(queryClient),
	});

	return {
		updateCategory: mutation.mutate,
		updateCategoryAsync: mutation.mutateAsync,
		isPending: mutation.isPending,
		error: mutation.error,
	};
}

export function useUpdateCategoryColor() {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async (data: UpdateCategoryColorInput) => {
			return categoriesApi.updateColor(data);
		},
		onSuccess: () => invalidateCategoryUsers(queryClient),
	});

	return {
		updateCategoryColor: mutation.mutate,
		updateCategoryColorAsync: mutation.mutateAsync,
		isPending: mutation.isPending,
		error: mutation.error,
	};
}

export function useDeleteCategory() {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async (id: bigint) => {
			return categoriesApi.delete(id);
		},
		onSuccess: () => invalidateCategoryUsers(queryClient),
	});

	return {
		deleteCategory: mutation.mutate,
		deleteCategoryAsync: mutation.mutateAsync,
		isPending: mutation.isPending,
		error: mutation.error,
	};
}
