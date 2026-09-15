"use client";

import { Ellipsis, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	PageContainer,
	PageContent,
	PageHeaderWithTitle,
} from "@/components/ui/layout";
import { EmptyState, ListRow, RowMenuButton } from "@/components/ui/list";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
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

function ColorDot({
	color,
	onCommit,
}: {
	color: string;
	onCommit: (color: string) => void;
}) {
	const [local, setLocal] = useState(color);
	const [open, setOpen] = useState(false);
	return (
		<Popover
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (o) setLocal(color);
				else if (local !== color) onCommit(local);
			}}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label="Change color"
					onClick={(e) => e.stopPropagation()}
					className="flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-muted"
				>
					<span
						className="size-2.5 rounded-full"
						style={{ backgroundColor: open ? local : color }}
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent
				className="w-auto p-3"
				align="start"
				onClick={(e) => e.stopPropagation()}
			>
				<HexColorPicker color={local} onChange={setLocal} />
				<Input
					value={local}
					onChange={(e) => setLocal(e.target.value)}
					className="mt-3 h-8 font-normal"
					aria-label="Hex color"
				/>
			</PopoverContent>
		</Popover>
	);
}

export default function CategoriesPage() {
	const { categories, isLoading, error } = useCategories();
	const { createCategoryAsync } = useCreateCategory();
	const { updateCategoryAsync } = useUpdateCategory();
	const { updateCategoryColorAsync } = useUpdateCategoryColor();
	const { deleteCategoryAsync, isPending: deleting } = useDeleteCategory();

	const [query, setQuery] = useState("");
	const [creating, setCreating] = useState<{ slug: string } | null>(null);
	const [editing, setEditing] = useState<Category | null>(null);
	const [deletingCat, setDeletingCat] = useState<Category | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const sorted = useMemo(
		() => [...categories].sort((a, b) => a.slug.localeCompare(b.slug)),
		[categories],
	);
	const q = query.trim().toLowerCase();
	const rows = q ? sorted.filter((c) => c.slug.includes(q)) : sorted;
	const childCount = (slug: string) =>
		categories.filter((c) => c.slug.startsWith(`${slug}.`)).length;

	const changeColor = async (category: Category, color: string) => {
		try {
			await updateCategoryColorAsync({
				id: category.id,
				slug: category.slug,
				color,
			});
		} catch {
			toast.error("Couldn't update color");
		}
	};

	const confirmDelete = async () => {
		if (!deletingCat) return;
		try {
			await deleteCategoryAsync(deletingCat.id);
			setDeletingCat(null);
			setDeleteError(null);
		} catch (e) {
			setDeleteError(
				e instanceof Error ? e.message : "Couldn't delete category",
			);
		}
	};

	const actions = (
		c: Category,
		Item: typeof ContextMenuItem,
		Separator: typeof ContextMenuSeparator,
	) => (
		<>
			<Item onClick={() => setEditing(c)}>
				<Pencil /> Edit
			</Item>
			<Item onClick={() => setCreating({ slug: `${c.slug}.` })}>
				<Plus /> Add subcategory
			</Item>
			<Separator />
			<Item variant="destructive" onClick={() => setDeletingCat(c)}>
				<Trash2 /> Delete
			</Item>
		</>
	);

	return (
		<PageContainer>
			<PageContent>
				<PageHeaderWithTitle
					title="categories"
					actions={
						<>
							<div className="relative">
								<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search"
									aria-label="Search categories"
									className="w-40 pl-8 sm:w-56"
									value={query}
									onChange={(e) => setQuery(e.target.value)}
								/>
							</div>
							<Button onClick={() => setCreating({ slug: "" })}>
								<Plus />
								New
							</Button>
						</>
					}
				/>

				{error && (
					<p className="mb-4 text-sm text-destructive">
						Couldn't load categories: {error.message}
					</p>
				)}

				{isLoading ? (
					<div className="divide-y">
						{[0, 1, 2, 3, 4, 5].map((i) => (
							<div key={i} className="flex items-center gap-3 py-2.5">
								<Skeleton className="size-2.5 rounded-full" />
								<Skeleton className="h-4 w-32" />
							</div>
						))}
					</div>
				) : rows.length === 0 ? (
					<EmptyState
						text={q ? "No categories match." : "No categories yet."}
						action={q ? undefined : "Add category"}
						onAction={() => setCreating({ slug: "" })}
					/>
				) : (
					<div className="divide-y border-t">
						{rows.map((c) => {
							const level = q ? 0 : getCategoryLevel(c.slug);
							const parent = getParentSlug(c.slug);
							return (
								<ContextMenu key={c.id.toString()}>
									<ContextMenuTrigger asChild>
										<ListRow
											className="py-1.5"
											onClick={() => setEditing(c)}
											style={{ paddingLeft: level * 24 }}
										>
											<div className="flex items-center gap-2">
												<ColorDot
													color={c.color}
													onCommit={(color) => changeColor(c, color)}
												/>
												<span className="min-w-0 flex-1 truncate">
													<span className="font-medium">
														{getCategoryDisplayName(c.slug)}
													</span>
													{q && parent && (
														<span className="ml-2 text-sm text-muted-foreground">
															{parent}
														</span>
													)}
												</span>
												<span className="hidden text-sm text-muted-foreground sm:block">
													{c.slug}
												</span>
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<RowMenuButton
															aria-label="Actions"
															className="mt-0"
															onClick={(e) => e.stopPropagation()}
														>
															<Ellipsis className="size-4" />
														</RowMenuButton>
													</DropdownMenuTrigger>
													<DropdownMenuContent
														align="end"
														onClick={(e) => e.stopPropagation()}
													>
														{actions(
															c,
															DropdownMenuItem,
															DropdownMenuSeparator,
														)}
													</DropdownMenuContent>
												</DropdownMenu>
											</div>
										</ListRow>
									</ContextMenuTrigger>
									<ContextMenuContent>
										{actions(c, ContextMenuItem, ContextMenuSeparator)}
									</ContextMenuContent>
								</ContextMenu>
							);
						})}
					</div>
				)}

				<CategoryDialog
					open={!!creating || !!editing}
					onOpenChange={(o) => {
						if (!o) {
							setCreating(null);
							setEditing(null);
						}
					}}
					category={editing}
					initialSlug={creating?.slug}
					onSave={async (slug, color) => {
						if (editing)
							await updateCategoryAsync({ id: editing.id, slug, color });
						else await createCategoryAsync({ slug, color });
					}}
				/>

				<AlertDialog
					open={!!deletingCat}
					onOpenChange={(o) => {
						if (!o) {
							setDeletingCat(null);
							setDeleteError(null);
						}
					}}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete {deletingCat?.slug}?</AlertDialogTitle>
							<AlertDialogDescription>
								{deletingCat && childCount(deletingCat.slug) > 0
									? `This also deletes ${childCount(deletingCat.slug)} subcategor${childCount(deletingCat.slug) === 1 ? "y" : "ies"}. `
									: ""}
								Transactions in it become uncategorized.
							</AlertDialogDescription>
						</AlertDialogHeader>
						{deleteError && (
							<p className="text-sm text-destructive">{deleteError}</p>
						)}
						<AlertDialogFooter>
							<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
							<AlertDialogAction onClick={confirmDelete} disabled={deleting}>
								{deleting ? "Deleting…" : "Delete"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</PageContent>
		</PageContainer>
	);
}
