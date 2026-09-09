"use client";

import * as React from "react";
import { Caption, ErrorMessage, Text, VStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/ui/color-swatch";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Category } from "@/gen/nagomi/v1/category_pb";
import { useCategories } from "@/hooks/useCategories";
import { generateRandomCategoryColor } from "@/lib/color-utils";
import { cn } from "@/lib/utils";

interface CategoryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	category?: Category | null;
	onSave: (slug: string, color: string) => Promise<void>;
	title: string;
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
	onSave,
	title,
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
				setSlug("");
				setColor(generateRandomCategoryColor());
			}
			setTypedSlug("");
			setSuggestions([]);
			setSuggestionIndex(-1);
			setShowSuggestions(false);
			setError(null);
		}
	}, [category, open]);

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
			setError("Invalid slug format. Use dot notation (e.g., food.groceries)");
			return;
		}

		if (slug.length < 1 || slug.length > 100) {
			setError("Slug must be between 1 and 100 characters");
			return;
		}

		const colorPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
		if (!colorPattern.test(color)) {
			setError("Invalid color format. Use hex format (#RGB or #RRGGBB)");
			return;
		}

		setIsLoading(true);
		try {
			await onSave(slug, color);
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save category");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
					</DialogHeader>
					<VStack spacing="md" className="py-4">
						<VStack spacing="xs">
							<Caption>slug</Caption>
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
										className="font-mono"
										autoComplete="off"
									/>
									{showSuggestions && (
										<div
											ref={suggestionsRef}
											className="absolute top-full left-0 right-0 z-50 mt-0.5 border rounded-sm bg-background shadow-md overflow-hidden"
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
														"w-full text-left px-3 py-1.5 text-sm font-mono transition-colors duration-150",
														i === suggestionIndex
															? "bg-accent text-accent-foreground"
															: "hover:bg-accent/50",
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
							<Text size="xs" color="muted">
								Use dots to create hierarchy:{" "}
								<code className="font-mono text-xs">parent.child</code>
							</Text>
						</VStack>
						{error && <ErrorMessage>{error}</ErrorMessage>}
					</VStack>
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
							{isLoading ? "saving..." : "save"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
