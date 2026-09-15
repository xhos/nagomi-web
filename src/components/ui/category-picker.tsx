"use client";

import { useMemo, useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { Category } from "@/gen/nagomi/v1/category_pb";
import { useCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/utils";
import { getCategoryDisplayName, getParentSlug } from "@/lib/utils/category";

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
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	const matches = useMemo(() => {
		const q = query.trim().toLowerCase();
		const sorted = [...categories].sort((a, b) => a.slug.localeCompare(b.slug));
		return q ? sorted.filter((c) => c.slug.toLowerCase().includes(q)) : sorted;
	}, [categories, query]);

	const pick = (c: Category | null) => {
		onChange(c);
		setOpen(false);
		setQuery("");
	};

	return (
		<Popover
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (!o) setQuery("");
			}}
		>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent
				align={align}
				className="w-60 p-0"
				onClick={(e) => e.stopPropagation()}
			>
				<input
					autoFocus
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && matches[0]) pick(matches[0]);
					}}
					placeholder="Category"
					aria-label="Search categories"
					className="w-full border-b bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
				/>
				<div className="max-h-64 overflow-y-auto p-1">
					{matches.map((c) => {
						const parent = getParentSlug(c.slug);
						return (
							<button
								key={c.id.toString()}
								type="button"
								onClick={() => pick(c)}
								className={cn(
									"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
									c.id === value && "bg-muted",
								)}
							>
								<span
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: c.color }}
								/>
								<span className="truncate">
									{getCategoryDisplayName(c.slug)}
								</span>
								{parent && (
									<span className="ml-auto truncate text-muted-foreground">
										{getCategoryDisplayName(parent)}
									</span>
								)}
							</button>
						);
					})}
					{matches.length === 0 && (
						<p className="px-2 py-3 text-sm text-muted-foreground">
							No matches
						</p>
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
