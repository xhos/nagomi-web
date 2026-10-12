"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { Category } from "@/gen/nagomi/v1/category_pb";
import { useCategories, useCreateCategory } from "@/hooks/useCategories";
import { generateRandomCategoryColor } from "@/lib/color-utils";
import { cn } from "@/lib/utils";
import { completeSlug, isValidSlug, searchSlugs } from "@/lib/utils/category";

// one row of a category search: the typed part reads in full color, the rest muted
export function SlugOption({
	slug,
	color,
	query,
	active,
	className,
	...props
}: React.ComponentProps<"button"> & {
	slug: string;
	color?: string;
	query: string;
	active: boolean;
}) {
	const q = query.trim().toLowerCase();
	const at = q ? slug.indexOf(q) : -1;
	return (
		<button
			type="button"
			className={cn(
				"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
				active && "bg-muted",
				className,
			)}
			{...props}
		>
			{color && (
				<span
					className="size-2 shrink-0 rounded-full"
					style={{ backgroundColor: color }}
				/>
			)}
			<span className="truncate">
				{at < 0 ? (
					slug
				) : (
					<>
						<span className="text-muted-foreground">{slug.slice(0, at)}</span>
						{slug.slice(at, at + q.length)}
						<span className="text-muted-foreground">
							{slug.slice(at + q.length)}
						</span>
					</>
				)}
			</span>
		</button>
	);
}

// the keys every category search shares: arrows move, Tab completes the common
// prefix or takes the chosen row, Enter takes the chosen row. `none` is the index
// meaning nothing is chosen: -1 where typing stands on its own, 0 where the top row is the default
export function useSlugKeys({
	slugs,
	query,
	setQuery,
	count,
	none,
	onAccept,
}: {
	slugs: string[];
	query: string;
	setQuery: (q: string) => void;
	count: number;
	none: -1 | 0;
	onAccept: (index: number) => void;
}) {
	const [active, setActive] = useState<number>(none);

	const type = (q: string) => {
		setQuery(q);
		setActive(none);
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "ArrowDown" && count > 0) {
			e.preventDefault();
			setActive(Math.min(active + 1, count - 1));
		} else if (e.key === "ArrowUp" && count > 0) {
			e.preventDefault();
			setActive(Math.max(active - 1, none));
		} else if (e.key === "Tab" && count > 0 && !e.shiftKey) {
			e.preventDefault();
			const completed = completeSlug(slugs, query);
			if (active !== none) onAccept(active);
			else if (completed !== query) type(completed);
			else if (active >= 0) onAccept(active);
		} else if (e.key === "Enter" && active >= 0 && active < count) {
			e.preventDefault();
			onAccept(active);
		}
	};

	return { active, setActive, type, onKeyDown };
}

interface CategoryPickerProps {
	value?: bigint;
	onChange: (category: Category | null) => void;
	children: React.ReactNode;
	align?: "start" | "end";
}

export function CategoryPicker({
	value,
	onChange,
	children,
	align = "start",
}: CategoryPickerProps) {
	const { categories } = useCategories();
	const { createCategoryAsync, isPending } = useCreateCategory();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [error, setError] = useState<string | null>(null);

	const slugs = useMemo(() => categories.map((c) => c.slug), [categories]);
	// closed pickers render per list row; skip the search until one opens
	const matches = useMemo(() => {
		if (!open) return [];
		const bySlug = new Map(categories.map((c) => [c.slug, c]));
		return searchSlugs(slugs, query).flatMap((s) => bySlug.get(s) ?? []);
	}, [categories, slugs, query, open]);

	const typed = query.trim().toLowerCase();
	const canCreate = !!typed && !slugs.includes(typed) && isValidSlug(typed);
	const count = matches.length + (canCreate ? 1 : 0);

	const close = () => {
		setOpen(false);
		setQuery("");
		setError(null);
	};

	const pick = (c: Category | null) => {
		onChange(c);
		close();
	};

	const create = async () => {
		setError(null);
		try {
			const c = await createCategoryAsync({
				slug: typed,
				color: generateRandomCategoryColor(),
			});
			if (c) pick(c);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Couldn't create category");
		}
	};

	const keys = useSlugKeys({
		slugs,
		query,
		setQuery,
		count,
		none: 0,
		onAccept: (i) => (i < matches.length ? pick(matches[i]) : create()),
	});

	return (
		<Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent
				align={align}
				className="w-64 p-0"
				onClick={(e) => e.stopPropagation()}
			>
				<input
					autoFocus
					value={query}
					onChange={(e) => keys.type(e.target.value.toLowerCase())}
					onKeyDown={keys.onKeyDown}
					placeholder="Category"
					aria-label="Search categories"
					autoComplete="off"
					className="w-full border-b bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
				/>
				<div className="max-h-64 overflow-y-auto p-1">
					{matches.map((c, i) => (
						<SlugOption
							key={c.id.toString()}
							slug={c.slug}
							color={c.color}
							query={query}
							active={i === keys.active}
							className={cn(c.id === value && "font-medium")}
							onMouseMove={() => keys.setActive(i)}
							onClick={() => pick(c)}
						/>
					))}
					{canCreate && (
						<button
							type="button"
							disabled={isPending}
							onMouseMove={() => keys.setActive(matches.length)}
							onClick={create}
							className={cn(
								"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
								keys.active === matches.length && "bg-muted",
							)}
						>
							<Plus className="size-4 shrink-0 text-muted-foreground" />
							<span className="truncate">
								{isPending ? "Creating…" : `Create “${typed}”`}
							</span>
						</button>
					)}
					{count === 0 && (
						<p className="px-2 py-3 text-sm text-muted-foreground">
							No matches
						</p>
					)}
					{error && (
						<p className="px-2 py-1.5 text-sm text-destructive">{error}</p>
					)}
					{value !== undefined && !query && (
						<button
							type="button"
							onClick={() => pick(null)}
							className="mt-1 flex w-full items-center gap-2 border-t px-2 py-1.5 pt-2 text-left text-sm text-muted-foreground hover:bg-muted"
						>
							Remove category
						</button>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
