"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CategoryPicker } from "@/components/ui/category-picker";
import { Input } from "@/components/ui/input";
import {
	PageContainer,
	PageContent,
	PageHeaderWithTitle,
} from "@/components/ui/layout";
import { EmptyState, ListRow } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import type { Category } from "@/gen/nagomi/v1/category_pb";
import type { RuleSuggestion } from "@/gen/nagomi/v1/rule_services_pb";
import { useCategories } from "@/hooks/useCategories";
import { useCreateRule, useRuleSuggestions } from "@/hooks/useRules";
import type { TransactionRule } from "@/lib/rules";
import { getCategoryDisplayName } from "@/lib/utils/category";

// trimming the end of the pattern keeps it a prefix; anything else falls back to contains
const operatorFor = (pattern: string, text: string) =>
	pattern.toLowerCase().startsWith(text.toLowerCase())
		? "starts_with"
		: "contains";

const ruleFor = (pattern: string, text: string): TransactionRule => ({
	logic: "AND",
	conditions: [
		{
			field: "tx_desc",
			operator: operatorFor(pattern, text),
			value: text,
			case_sensitive: false,
		},
	],
});

export default function SuggestedRulesPage() {
	const { data, isLoading, error } = useRuleSuggestions();
	const [open, setOpen] = useState<string | null>(null);

	const suggestions = data?.suggestions ?? [];

	return (
		<PageContainer>
			<PageContent>
				<PageHeaderWithTitle
					title="suggested rules"
					subtitle={
						data
							? `${data.uncategorizedCount.toLocaleString()} uncategorized transactions. The most common descriptions come first.`
							: undefined
					}
				/>

				{error && (
					<p className="mb-4 text-sm text-destructive">
						Couldn't load suggestions: {error.message}
					</p>
				)}

				{isLoading ? (
					<div className="divide-y border-t">
						{[0, 1, 2, 3, 4, 5].map((i) => (
							<div key={i} className="flex justify-between py-2.5">
								<Skeleton className="h-4 w-48" />
								<Skeleton className="h-4 w-8" />
							</div>
						))}
					</div>
				) : suggestions.length === 0 ? (
					!error && (
						<EmptyState text="No description repeats often enough among uncategorized transactions." />
					)
				) : (
					<div className="divide-y border-t">
						{suggestions.map((s) => (
							<SuggestionRow
								key={s.pattern}
								suggestion={s}
								expanded={open === s.pattern}
								onToggle={() => setOpen(open === s.pattern ? null : s.pattern)}
							/>
						))}
					</div>
				)}
			</PageContent>
		</PageContainer>
	);
}

function SuggestionRow({
	suggestion: s,
	expanded,
	onToggle,
}: {
	suggestion: RuleSuggestion;
	expanded: boolean;
	onToggle: () => void;
}) {
	const { categoryMap } = useCategories();
	const { createRule, isPending, error, reset } = useCreateRule();
	const [text, setText] = useState(s.pattern);
	const [picked, setPicked] = useState<Category>();
	// preselect what most similar categorized transactions use
	const category =
		picked ??
		(s.categoryId ? categoryMap.get(s.categoryId.toString()) : undefined);

	const value = text.trim();
	const submit = () => {
		if (!value || !category) return;
		createRule({
			ruleName: value.slice(0, 255),
			categoryId: category.id,
			conditions: ruleFor(s.pattern, value),
			applyToExisting: true,
		});
	};

	return (
		<ListRow expanded={expanded} onClick={onToggle} className="py-2.5">
			<div className="flex items-baseline gap-3">
				<span className="min-w-0 flex-1 truncate">{s.pattern}</span>
				<span className="shrink-0 text-sm text-muted-foreground tabular-nums">
					{s.transactionCount.toLocaleString()}
				</span>
			</div>

			{expanded && (
				<div
					className="mt-3 border-t pt-3"
					onClick={(e) => e.stopPropagation()}
				>
					<form
						className="flex flex-wrap items-center gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							submit();
						}}
					>
						<Input
							autoFocus
							aria-label="Description pattern"
							value={text}
							onChange={(e) => {
								setText(e.target.value);
								reset();
							}}
							className="min-w-0 flex-1 basis-64"
						/>
						<CategoryPicker
							value={category?.id}
							align="end"
							onChange={(c) => c && setPicked(c)}
						>
							<Button type="button" variant="outline">
								{category ? (
									<>
										<span
											className="size-2 rounded-full"
											style={{ backgroundColor: category.color }}
										/>
										{getCategoryDisplayName(category.slug)}
									</>
								) : (
									"Category"
								)}
							</Button>
						</CategoryPicker>
						<Button type="submit" disabled={!value || !category || isPending}>
							{isPending ? "Saving…" : "Create rule"}
						</Button>
					</form>
					<p className="mt-2 text-sm text-muted-foreground">
						{value
							? `Categorizes every description that ${
									operatorFor(s.pattern, value) === "starts_with"
										? "starts with"
										: "contains"
								} “${value}”, now and in future.`
							: "Enter part of the description to match."}
					</p>
					{error && (
						<p className="mt-1 text-sm text-destructive">
							Couldn't create the rule: {error.message}
						</p>
					)}
					<div className="mt-3 space-y-0.5 text-sm text-muted-foreground">
						{s.examples.map((x) => (
							<div key={x} className="truncate">
								{x}
							</div>
						))}
					</div>
				</div>
			)}
		</ListRow>
	);
}
