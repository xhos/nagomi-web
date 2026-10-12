"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { SlugOption, useSlugKeys } from "@/components/ui/category-picker";
import { ColorSwatch } from "@/components/ui/color-swatch";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/forms";
import { Input } from "@/components/ui/input";
import type { Category } from "@/gen/nagomi/v1/category_pb";
import { useCategories } from "@/hooks/useCategories";
import { generateRandomCategoryColor } from "@/lib/color-utils";
import { isValidSlug, searchSlugs } from "@/lib/utils/category";

interface CategoryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	category?: Category | null;
	initialSlug?: string;
	onSave: (slug: string, color: string) => Promise<void>;
}

export function CategoryDialog({
	open,
	onOpenChange,
	category,
	initialSlug,
	onSave,
}: CategoryDialogProps) {
	const { categories } = useCategories();

	const [slug, setSlug] = React.useState("");
	const [showSuggestions, setShowSuggestions] = React.useState(false);

	const [color, setColor] = React.useState(generateRandomCategoryColor);
	const [isLoading, setIsLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	// the same search as every category picker, minus the slug being edited
	const others = categories
		.map((c) => c.slug)
		.filter((s) => s !== category?.slug);
	const suggestions = slug
		? searchSlugs(others, slug)
				.filter((s) => s !== slug)
				.slice(0, 8)
		: [];
	const showList = showSuggestions && suggestions.length > 0;

	const accept = (value: string) => {
		setSlug(value);
		setShowSuggestions(false);
	};

	const keys = useSlugKeys({
		slugs: others,
		query: slug,
		setQuery: (q) => {
			setSlug(q);
			setShowSuggestions(true);
		},
		count: showList ? suggestions.length : 0,
		none: -1,
		onAccept: (i) => accept(suggestions[i]),
	});

	React.useEffect(() => {
		if (open) {
			if (category) {
				setSlug(category.slug);
				setColor(category.color);
			} else {
				setSlug(initialSlug ?? "");
				setColor(generateRandomCategoryColor());
			}
			setShowSuggestions(false);
			setError(null);
		}
	}, [category, initialSlug, open]);

	const colorBySlug = new Map(categories.map((c) => [c.slug, c.color]));

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!isValidSlug(slug)) {
			setError(
				slug.length > 100
					? "Keep the slug between 1 and 100 characters."
					: "Use dot notation, like food.groceries.",
			);
			return;
		}

		const colorPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
		if (!colorPattern.test(color)) {
			setError("Color must be a hex value like #3b82f6.");
			return;
		}

		setIsLoading(true);
		try {
			await onSave(slug, color);
			onOpenChange(false);
		} catch (err) {
			const m = err instanceof Error ? err.message : "Couldn't save category";
			setError(
				m.includes("duplicate key") || m.includes("unique constraint")
					? "A category with this slug already exists."
					: m,
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[460px]">
				<form onSubmit={handleSubmit} className="space-y-4">
					<DialogHeader>
						<DialogTitle>
							{category ? "edit category" : "new category"}
						</DialogTitle>
					</DialogHeader>
					<Field
						label="Slug"
						htmlFor="slug"
						hint="Dots make hierarchy: parent.child"
					>
						<div className="flex items-center gap-2">
							<div className="relative flex-1">
								<Input
									id="slug"
									value={slug}
									onChange={(e) => keys.type(e.target.value.toLowerCase())}
									onKeyDown={(e) => {
										if (e.key === "Escape" && showList) {
											e.preventDefault();
											setShowSuggestions(false);
										} else keys.onKeyDown(e);
									}}
									onBlur={() =>
										setTimeout(() => setShowSuggestions(false), 100)
									}
									placeholder="food.groceries"
									disabled={isLoading}
									autoComplete="off"
									autoFocus
								/>
								{showList && (
									<div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border bg-popover p-1 shadow-md">
										{suggestions.map((s, i) => (
											<SlugOption
												key={s}
												slug={s}
												color={colorBySlug.get(s)}
												query={slug}
												active={i === keys.active}
												onMouseMove={() => keys.setActive(i)}
												onMouseDown={(e) => {
													e.preventDefault();
													accept(s);
												}}
											/>
										))}
									</div>
								)}
							</div>
							<ColorSwatch
								color={color}
								onChange={setColor}
								disabled={isLoading}
							/>
						</div>
					</Field>
					<FormError>{error}</FormError>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isLoading}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isLoading}>
							{isLoading ? "Saving…" : "Save"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
