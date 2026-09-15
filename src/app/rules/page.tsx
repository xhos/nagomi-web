"use client";

import { format } from "date-fns";
import { Ellipsis, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import {
	DetailRow,
	EmptyState,
	ListRow,
	RowMenuButton,
} from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { Rule } from "@/gen/nagomi/v1/rule_pb";
import { useCategories } from "@/hooks/useCategories";
import {
	useCreateRule,
	useDeleteRule,
	useRules,
	useUpdateRule,
} from "@/hooks/useRules";
import type { TransactionRule } from "@/lib/rules";
import { RuleDialog } from "./components/RuleDialog";
import { describeRule } from "./describe";

const stamp = (t?: { seconds?: bigint }) =>
	t?.seconds ? format(new Date(Number(t.seconds) * 1000), "MMM d, yyyy") : null;

export default function RulesPage() {
	const { rules, isLoading, error } = useRules();
	const { categories, categoryMap } = useCategories();
	const {
		createRule,
		isPending: creating,
		error: createError,
		reset: resetCreate,
	} = useCreateRule();
	const {
		updateRule,
		isPending: updating,
		error: updateError,
		reset: resetUpdate,
	} = useUpdateRule();
	const { deleteRule, isPending: deleting } = useDeleteRule();

	const [query, setQuery] = useState("");
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [creatingOpen, setCreatingOpen] = useState(false);
	const [editing, setEditing] = useState<Rule | null>(null);
	const [deletingRule, setDeletingRule] = useState<Rule | null>(null);

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		return [...rules]
			.filter((r) => !q || r.ruleName.toLowerCase().includes(q))
			.sort(
				(a, b) =>
					a.priorityOrder - b.priorityOrder ||
					a.ruleName.localeCompare(b.ruleName),
			);
	}, [rules, query]);

	const categoryOf = (r: Rule) =>
		r.categoryId ? categoryMap.get(r.categoryId.toString()) : undefined;

	const toggleActive = (r: Rule) =>
		updateRule({
			ruleId: r.ruleId,
			data: {
				ruleName: r.ruleName,
				categoryId: r.categoryId,
				merchant: r.merchant,
				conditions: r.conditions as unknown as TransactionRule,
				isActive: !r.isActive,
				priorityOrder: r.priorityOrder,
			},
		});

	const actions = (
		r: Rule,
		Item: typeof ContextMenuItem,
		Separator: typeof ContextMenuSeparator,
	) => (
		<>
			<Item onClick={() => setEditing(r)}>
				<Pencil /> Edit
			</Item>
			<Separator />
			<Item variant="destructive" onClick={() => setDeletingRule(r)}>
				<Trash2 /> Delete
			</Item>
		</>
	);

	return (
		<PageContainer>
			<PageContent>
				<PageHeaderWithTitle
					title="rules"
					actions={
						<>
							<div className="relative">
								<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search"
									aria-label="Search rules"
									className="w-40 pl-8 sm:w-56"
									value={query}
									onChange={(e) => setQuery(e.target.value)}
								/>
							</div>
							<Button onClick={() => setCreatingOpen(true)}>
								<Plus />
								New
							</Button>
						</>
					}
				/>

				{error && (
					<p className="mb-4 text-sm text-destructive">
						Couldn't load rules: {error.message}
					</p>
				)}

				{isLoading ? (
					<div className="divide-y">
						{[0, 1, 2, 3].map((i) => (
							<div key={i} className="space-y-2 py-2.5">
								<Skeleton className="h-4 w-40" />
								<Skeleton className="h-3 w-72" />
							</div>
						))}
					</div>
				) : rows.length === 0 ? (
					<EmptyState
						text={
							query
								? "No rules match."
								: "No rules yet. Rules categorize new transactions for you."
						}
						action={query ? undefined : "Add rule"}
						onAction={() => setCreatingOpen(true)}
					/>
				) : (
					<div className="divide-y border-t">
						{rows.map((r) => {
							const d = describeRule(r.conditions);
							const cat = categoryOf(r);
							const expanded = expandedId === r.ruleId;
							return (
								<ContextMenu key={r.ruleId}>
									<ContextMenuTrigger asChild>
										<ListRow
											expanded={expanded}
											onClick={() => setExpandedId(expanded ? null : r.ruleId)}
											className={r.isActive ? undefined : "opacity-60"}
										>
											<div className="flex items-start gap-3">
												<div className="min-w-0 flex-1">
													<div className="truncate font-medium">
														{r.ruleName}
													</div>
													<div className="truncate text-sm text-muted-foreground">
														{d.parts.length
															? `When ${d.parts.join(` ${d.logic} `)}`
															: "No conditions"}
													</div>
												</div>
												<span className="hidden shrink-0 items-center gap-1.5 text-sm text-muted-foreground sm:flex">
													{cat && (
														<>
															<span
																className="size-2 rounded-full"
																style={{ backgroundColor: cat.color }}
															/>
															{cat.slug}
														</>
													)}
													{cat && r.merchant && " · "}
													{r.merchant}
												</span>
												<Switch
													aria-label={r.isActive ? "Pause rule" : "Resume rule"}
													checked={r.isActive}
													onCheckedChange={() => toggleActive(r)}
													onClick={(e) => e.stopPropagation()}
													disabled={updating}
													className="mt-0.5"
												/>
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<RowMenuButton
															aria-label="Actions"
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
															r,
															DropdownMenuItem,
															DropdownMenuSeparator,
														)}
													</DropdownMenuContent>
												</DropdownMenu>
											</div>

											{expanded && (
												<div
													className="mt-3 border-t pt-3"
													onClick={(e) => e.stopPropagation()}
												>
													<div className="grid gap-x-8 sm:grid-cols-2">
														<div>
															<DetailRow label="When">
																{d.parts.map((p, i) => (
																	<span key={p} className="block">
																		{i > 0 && (
																			<span className="text-muted-foreground">
																				{d.logic}{" "}
																			</span>
																		)}
																		{p}
																	</span>
																))}
															</DetailRow>
															<DetailRow label="Then">
																{cat && `Set category to ${cat.slug}`}
																{cat && r.merchant && <br />}
																{r.merchant && `Set merchant to ${r.merchant}`}
																{!cat && !r.merchant && "—"}
															</DetailRow>
														</div>
														<div>
															<DetailRow label="Priority">
																{r.priorityOrder}
															</DetailRow>
															<DetailRow label="Applied">
																{r.timesApplied} time
																{r.timesApplied === 1 ? "" : "s"}
																{stamp(r.lastAppliedAt) &&
																	`, last ${stamp(r.lastAppliedAt)}`}
															</DetailRow>
															<DetailRow label="Created">
																{stamp(r.createdAt) ?? "—"}
															</DetailRow>
														</div>
													</div>
													<div className="mt-3 flex gap-2">
														<Button
															variant="outline"
															size="sm"
															onClick={() => setEditing(r)}
														>
															Edit
														</Button>
														<Button
															variant="ghost"
															size="sm"
															className="ml-auto text-destructive hover:text-destructive"
															onClick={() => setDeletingRule(r)}
														>
															Delete
														</Button>
													</div>
												</div>
											)}
										</ListRow>
									</ContextMenuTrigger>
									<ContextMenuContent>
										{actions(r, ContextMenuItem, ContextMenuSeparator)}
									</ContextMenuContent>
								</ContextMenu>
							);
						})}
					</div>
				)}

				<RuleDialog
					isOpen={creatingOpen}
					onClose={() => {
						setCreatingOpen(false);
						resetCreate();
					}}
					onSubmit={(data) =>
						createRule(data, { onSuccess: () => setCreatingOpen(false) })
					}
					categories={categories}
					title="new rule"
					submitText="Create rule"
					isLoading={creating}
					error={createError?.message}
				/>
				<RuleDialog
					isOpen={!!editing}
					onClose={() => {
						setEditing(null);
						resetUpdate();
					}}
					onSubmit={(data) =>
						editing &&
						updateRule(
							{ ruleId: editing.ruleId, data },
							{ onSuccess: () => setEditing(null) },
						)
					}
					categories={categories}
					rule={editing}
					title="edit rule"
					submitText="Save"
					isLoading={updating}
					error={updateError?.message}
				/>

				<AlertDialog
					open={!!deletingRule}
					onOpenChange={(o) => !o && setDeletingRule(null)}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								Delete {deletingRule?.ruleName}?
							</AlertDialogTitle>
							<AlertDialogDescription>
								Transactions it already categorized keep their category.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
							<AlertDialogAction
								disabled={deleting}
								onClick={() =>
									deletingRule &&
									deleteRule(deletingRule.ruleId, {
										onSuccess: () => setDeletingRule(null),
									})
								}
							>
								{deleting ? "Deleting…" : "Delete"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</PageContent>
		</PageContainer>
	);
}
