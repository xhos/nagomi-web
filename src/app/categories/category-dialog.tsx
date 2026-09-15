"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

interface CategoryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	category?: Category | null;
	initialSlug?: string;
	onSave: (slug: string, color: string) => Promise<void>;
}

function longestCommonPrefix(strings: string[]): string {
	if (!strings.length) return "";
	return strings.reduce((prefix, s) => {
		while (!s.startsWith(prefix)) prefix = prefix.slice(0, -1);
		return prefix;
	});
}

export function CategoryDialog({
	open,
	onOpenChange,
	category,
	initialSlug,
	onSave,
}: CategoryDialogProps) {
	const { categories } = useCategories();
	const existingSlugs = categories.map((c) => c.slug);

	const [slug, setSlug] = React.useState("");
	const [typedSlug, setTypedSlug] = React.useState("");
	const [suggestions, setSuggestions] = React.useState<string[]>([]);
	const [suggestionIndex, setSuggestionIndex] = React.useState(-1);
	const [showSuggestions, setShowSuggestions] = React.useState(false);

	const [color, setColor] = React.useState(generateRandomCategoryColor);
	const [isLoading, setIsLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const suggestionsRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		if (open) {
			if (category) {
				setSlug(category.slug);
				setColor(category.color);
			} else {
				setSlug(initialSlug ?? "");
				setColor(generateRandomCategoryColor());
			}
			setTypedSlug(initialSlug ?? "");
			setSuggestions([]);
			setSuggestionIndex(-1);
			setShowSuggestions(false);
			setError(null);
		}
	}, [category, initialSlug, open]);

	const computeSuggestions = (value: string) =>
		existingSlugs.filter((s) => s.startsWith(value) && s !== value).slice(0, 8);

	const handleSlugChange = (value: string) => {
		const normalized = value.toLowerCase();
		setSlug(normalized);
		setTypedSlug(normalized);
		setSuggestionIndex(-1);
		if (normalized) {
			const matches = computeSuggestions(normalized);
			setSuggestions(matches);
			setShowSuggestions(matches.length > 0);
		} else {
			setSuggestions([]);
			setShowSuggestions(false);
		}
	};

	const acceptSuggestion = (value: string) => {
		setSlug(value);
		setTypedSlug(value);
		setSuggestions([]);
		setSuggestionIndex(-1);
		setShowSuggestions(false);
	};

	const dismissSuggestions = () => {
		setSlug(typedSlug);
		setSuggestionIndex(-1);
		setShowSuggestions(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (!showSuggestions) return;

		if (e.key === "Tab") {
			e.preventDefault();
			if (suggestionIndex >= 0) {
				acceptSuggestion(suggestions[suggestionIndex]);
			} else {
				const prefix = longestCommonPrefix(suggestions);
				if (prefix.length > typedSlug.length) {
					setSlug(prefix);
					setTypedSlug(prefix);
					setSuggestionIndex(-1);
					const newMatches = computeSuggestions(prefix);
					setSuggestions(newMatches);
					setShowSuggestions(newMatches.length > 0);
				}
			}
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			const newIndex = Math.min(suggestionIndex + 1, suggestions.length - 1);
			setSuggestionIndex(newIndex);
			setSlug(suggestions[newIndex]);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			if (suggestionIndex <= 0) {
				setSuggestionIndex(-1);
				setSlug(typedSlug);
			} else {
				const newIndex = suggestionIndex - 1;
				setSuggestionIndex(newIndex);
				setSlug(suggestions[newIndex]);
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			dismissSuggestions();
		} else if (e.key === "Enter" && suggestionIndex >= 0) {
			e.preventDefault();
			acceptSuggestion(suggestions[suggestionIndex]);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		const slugPattern = /^[^.]+(\.[^.]+)*$/;
		if (!slugPattern.test(slug)) {
			setError("Use dot notation, like food.groceries.");
			return;
		}

		if (slug.length < 1 || slug.length > 100) {
			setError("Keep the slug between 1 and 100 characters.");
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
									onChange={(e) => handleSlugChange(e.target.value)}
									onKeyDown={handleKeyDown}
									onBlur={() => setTimeout(dismissSuggestions, 100)}
									placeholder="food.groceries"
									disabled={isLoading}
									autoComplete="off"
									autoFocus
								/>
								{showSuggestions && (
									<div
										ref={suggestionsRef}
										className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border bg-popover p-1 shadow-md"
									>
										{suggestions.map((s, i) => (
											<button
												key={s}
												type="button"
												onMouseDown={(e) => {
													e.preventDefault();
													acceptSuggestion(s);
												}}
												className={cn(
													"w-full rounded-md px-2 py-1.5 text-left text-sm",
													i === suggestionIndex ? "bg-muted" : "hover:bg-muted",
												)}
											>
												<span>{s.slice(0, typedSlug.length)}</span>
												<span className="text-muted-foreground">
													{s.slice(typedSlug.length)}
												</span>
											</button>
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
