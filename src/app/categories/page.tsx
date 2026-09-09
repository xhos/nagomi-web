"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, ErrorMessage, LoadingSkeleton } from "@/components/lib";
import {
	PageContainer,
	PageContent,
	PageHeaderWithTitle,
} from "@/components/ui/layout";
import type { Category } from "@/gen/nagomi/v1/category_pb";
import {
	useCategories,
	useCreateCategory,
	useDeleteCategory,
	useUpdateCategory,
	useUpdateCategoryColor,
} from "@/hooks/useCategories";
import {
	getCategoryDisplayName,
	getCategoryLevel,
	getParentSlug,
} from "@/lib/utils/category";
import { CategoryDialog } from "./category-dialog";
import { type CategoryRow, createColumns } from "./columns";
import { DataTable } from "./data-table";
import { DeleteDialog } from "./delete-dialog";

function countChildren(categorySlug: string, categories: Category[]): number {
	return categories.filter((c) => c.slug.startsWith(`${categorySlug}.`)).length;
}

export default function CategoriesPage() {
	const [editingCategory, setEditingCategory] = React.useState<Category | null>(
		null,
	);
	const [deletingCategory, setDeletingCategory] =
		React.useState<Category | null>(null);
	const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
	const [isFiltered, setIsFiltered] = React.useState(false);

	const { categories, isLoading, error } = useCategories();
	const { createCategoryAsync } = useCreateCategory();
	const { updateCategoryAsync } = useUpdateCategory();
	const { updateCategoryColorAsync } = useUpdateCategoryColor();
	const { deleteCategoryAsync } = useDeleteCategory();

	const categoryRows: CategoryRow[] = categories.map((category) => ({
		category,
		level: getCategoryLevel(category.slug),
		displayName: getCategoryDisplayName(category.slug),
		parentSlug: getParentSlug(category.slug),
	}));

	const handleCreateCategory = async (slug: string, color: string) => {
		try {
			await createCategoryAsync({ slug, color });
			toast.success("Category created");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			const isDuplicateSlug =
				errorMessage.includes("duplicate key") ||
				errorMessage.includes("unique constraint");

			if (isDuplicateSlug) {
				toast.error("A category with this slug already exists");
			} else {
				toast.error("Failed to create category");
			}
			throw error;
		}
	};

	const handleUpdateCategory = async (slug: string, color: string) => {
		if (!editingCategory) return;

		try {
			await updateCategoryAsync({
				id: editingCategory.id,
				slug,
				color,
			});
			toast.success("Category updated");
			setEditingCategory(null);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			const isDuplicateSlug =
				errorMessage.includes("duplicate key") ||
				errorMessage.includes("unique constraint");

			if (isDuplicateSlug) {
				toast.error("A category with this slug already exists");
			} else {
				toast.error("Failed to update category");
			}
			throw error;
		}
	};

	const handleColorChange = async (category: Category, color: string) => {
		try {
			await updateCategoryColorAsync({
				id: category.id,
				slug: category.slug,
				color,
			});
			toast.success("Color updated");
		} catch (error) {
			toast.error("Failed to update color");
			console.error("Failed to update category color:", error);
		}
	};

	const handleDeleteCategory = async () => {
		if (!deletingCategory) return;

		try {
			await deleteCategoryAsync(deletingCategory.id);
			toast.success("Category deleted");
			setDeletingCategory(null);
		} catch (error) {
			toast.error("Failed to delete category");
			console.error("Failed to delete category:", error);
			throw error;
		}
	};

	const columns = createColumns(
		setEditingCategory,
		setDeletingCategory,
		isFiltered,
		handleColorChange,
	);

	if (isLoading) {
		return (
			<PageContainer>
				<PageContent>
					<PageHeaderWithTitle title="categories" />
					<Card title="categories" padding="md">
						<LoadingSkeleton lines={5} />
					</Card>
				</PageContent>
			</PageContainer>
		);
	}

	if (error) {
		return (
			<PageContainer>
				<PageContent>
					<PageHeaderWithTitle title="categories" />
					<ErrorMessage>Error loading categories: {error.message}</ErrorMessage>
				</PageContent>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageContent>
				<PageHeaderWithTitle
					title="categories"
					subtitle="Manage your transaction categories with hierarchical organization. Right-click rows for actions."
				/>

				<DataTable
					columns={columns}
					data={categoryRows}
					onFilterChange={setIsFiltered}
					onEdit={(row) => setEditingCategory(row.category)}
					onDelete={(row) => setDeletingCategory(row.category)}
					onCreateNew={() => setIsCreateDialogOpen(true)}
				/>

				<CategoryDialog
					open={isCreateDialogOpen}
					onOpenChange={setIsCreateDialogOpen}
					onSave={handleCreateCategory}
					title="create category"
				/>

				<CategoryDialog
					open={!!editingCategory}
					onOpenChange={(open) => !open && setEditingCategory(null)}
					category={editingCategory}
					onSave={handleUpdateCategory}
					title="edit category"
				/>

				<DeleteDialog
					open={!!deletingCategory}
					onOpenChange={(open) => !open && setDeletingCategory(null)}
					category={deletingCategory}
					childCount={
						deletingCategory
							? countChildren(deletingCategory.slug, categories)
							: 0
					}
					onConfirm={handleDeleteCategory}
				/>
			</PageContent>
		</PageContainer>
	);
}
