"use client";

import * as React from "react";
import { CategoryDialog } from "@/app/categories/category-dialog";
import { Button } from "@/components/ui/button";
import { CategoryPicker } from "@/components/ui/category-picker";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormError, NativeSelect } from "@/components/ui/forms";
import { Input } from "@/components/ui/input";
import { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories, useCreateCategory } from "@/hooks/useCategories";
import { useCurrencies } from "@/hooks/useCurrencies";
import { cn } from "@/lib/utils";

interface TransactionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	transaction?: Transaction | null;
	onSave: (formData: {
		accountId: bigint;
		txDate: Date;
		txAmount: { currencyCode: string; units: string; nanos: number };
		direction: TransactionDirection;
		description?: string;
		merchant?: string;
		userNotes?: string;
		categoryId?: bigint | null;
	}) => Promise<void>;
	title: string;
}

export function TransactionDialog({
	open,
	onOpenChange,
	transaction,
	onSave,
	title,
}: TransactionDialogProps) {
	const { accounts } = useAccounts();
	const { categories } = useCategories();
	const { currencies } = useCurrencies();
	const { createCategoryAsync } = useCreateCategory();
	const [isLoading, setIsLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [createCategoryOpen, setCreateCategoryOpen] = React.useState(false);
	const [pendingCategorySlug, setPendingCategorySlug] = React.useState<
		string | null
	>(null);

	React.useEffect(() => {
		if (!pendingCategorySlug) return;
		const match = categories.find((c) => c.slug === pendingCategorySlug);
		if (match) {
			setFormData((prev) => ({ ...prev, categoryId: match.id.toString() }));
			setPendingCategorySlug(null);
		}
	}, [categories, pendingCategorySlug]);

	const [formData, setFormData] = React.useState({
		accountId: "",
		amount: "",
		currency: "USD",
		direction: TransactionDirection.DIRECTION_OUTGOING,
		date: new Date().toISOString().split("T")[0],
		time: new Date().toTimeString().slice(0, 5),
		merchant: "",
		categoryId: "",
		description: "",
		userNotes: "",
	});

	React.useEffect(() => {
		if (open) {
			if (transaction) {
				const txDate = transaction.txDate?.seconds
					? new Date(Number(transaction.txDate.seconds) * 1000)
					: new Date();

				const amount = transaction.txAmount
					? (
							Number(transaction.txAmount.units) +
							(transaction.txAmount.nanos || 0) / 1e9
						).toString()
					: "";

				setFormData({
					accountId: transaction.accountId?.toString() || "",
					amount,
					currency: transaction.txAmount?.currencyCode || "USD",
					direction:
						transaction.direction || TransactionDirection.DIRECTION_OUTGOING,
					date: txDate.toISOString().split("T")[0],
					time: txDate.toTimeString().slice(0, 5),
					merchant: transaction.merchant || "",
					categoryId: transaction.categoryId?.toString() || "",
					description: transaction.description || "",
					userNotes: transaction.userNotes || "",
				});
			} else {
				const lastUsedAccountId =
					localStorage.getItem("lastUsedAccountId") ?? "";
				const lastUsedAccount = accounts.find(
					(a) => a.id.toString() === lastUsedAccountId,
				);
				setFormData({
					accountId: lastUsedAccountId,
					amount: "",
					currency: lastUsedAccount?.mainCurrency || "USD",
					direction: TransactionDirection.DIRECTION_OUTGOING,
					date: new Date().toISOString().split("T")[0],
					time: new Date().toTimeString().slice(0, 5),
					merchant: "",
					categoryId: "",
					description: "",
					userNotes: "",
				});
			}
			setError(null);
		}
	}, [transaction, open, accounts]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!formData.accountId) {
			setError("Choose an account.");
			return;
		}
		if (!formData.amount || parseFloat(formData.amount) <= 0) {
			setError("Enter an amount above zero.");
			return;
		}
		if (!formData.description.trim()) {
			setError("Enter a description.");
			return;
		}

		setIsLoading(true);
		try {
			localStorage.setItem("lastUsedAccountId", formData.accountId);
			await onSave({
				accountId: BigInt(formData.accountId),
				txDate: new Date(`${formData.date}T${formData.time}`),
				txAmount: {
					currencyCode: formData.currency,
					units: Math.floor(parseFloat(formData.amount)).toString(),
					nanos: Math.round((parseFloat(formData.amount) % 1) * 1e9),
				},
				direction: formData.direction,
				description: formData.description || undefined,
				merchant: formData.merchant || undefined,
				userNotes: formData.userNotes || undefined,
				categoryId: formData.categoryId ? BigInt(formData.categoryId) : null,
			});
			onOpenChange(false);
		} catch (err) {
			const message = err instanceof Error ? err.message : undefined;
			setError(message || "Couldn't save transaction");
		} finally {
			setIsLoading(false);
		}
	};

	const set = <K extends keyof typeof formData>(
		key: K,
		value: (typeof formData)[K],
	) => setFormData((prev) => ({ ...prev, [key]: value }));

	return (
		<>
			<CategoryDialog
				open={createCategoryOpen}
				onOpenChange={setCreateCategoryOpen}
				onSave={async (slug, color) => {
					await createCategoryAsync({ slug, color });
					setPendingCategorySlug(slug);
				}}
			/>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-[520px]">
					<form onSubmit={handleSubmit} className="space-y-4">
						<DialogHeader>
							<DialogTitle>{title}</DialogTitle>
						</DialogHeader>

						<div className="flex gap-2">
							{(
								[
									[TransactionDirection.DIRECTION_OUTGOING, "Expense"],
									[TransactionDirection.DIRECTION_INCOMING, "Income"],
								] as const
							).map(([dir, label]) => (
								<button
									key={dir}
									type="button"
									onClick={() => set("direction", dir)}
									className={cn(
										"h-8 rounded-md border px-3 text-sm transition-colors",
										formData.direction === dir
											? "border-foreground bg-foreground text-background"
											: "hover:bg-muted",
									)}
								>
									{label}
								</button>
							))}
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<Field label="Account" htmlFor="tx-account">
								<NativeSelect
									id="tx-account"
									value={formData.accountId}
									onChange={(e) => {
										const a = accounts.find(
											(x) => x.id.toString() === e.target.value,
										);
										setFormData((prev) => ({
											...prev,
											accountId: e.target.value,
											currency: a?.mainCurrency || prev.currency,
										}));
									}}
									disabled={isLoading}
									required
								>
									<option value="">Choose an account</option>
									{accounts.map((a) => (
										<option key={a.id.toString()} value={a.id.toString()}>
											{a.friendlyName || a.name} · {a.bank}
										</option>
									))}
								</NativeSelect>
							</Field>
							<Field label="Amount" htmlFor="tx-amount">
								<div className="flex gap-2">
									<NativeSelect
										aria-label="Currency"
										className="w-24"
										value={formData.currency}
										onChange={(e) => set("currency", e.target.value)}
										disabled={isLoading}
									>
										{currencies.map(({ code }) => (
											<option key={code} value={code}>
												{code}
											</option>
										))}
									</NativeSelect>
									<Input
										id="tx-amount"
										type="number"
										step="0.01"
										value={formData.amount}
										onChange={(e) => set("amount", e.target.value)}
										placeholder="0.00"
										disabled={isLoading}
										required
										autoFocus
									/>
								</div>
							</Field>
						</div>

						<Field label="Description" htmlFor="tx-desc">
							<Input
								id="tx-desc"
								value={formData.description}
								onChange={(e) => set("description", e.target.value)}
								placeholder="What was this for"
								disabled={isLoading}
							/>
						</Field>

						<div className="grid gap-4 sm:grid-cols-2">
							<Field label="Date" htmlFor="tx-date">
								<Input
									id="tx-date"
									type="date"
									value={formData.date}
									onChange={(e) => set("date", e.target.value)}
									disabled={isLoading}
								/>
							</Field>
							<Field label="Time" htmlFor="tx-time">
								<Input
									id="tx-time"
									type="time"
									value={formData.time}
									onChange={(e) => set("time", e.target.value)}
									disabled={isLoading}
								/>
							</Field>
						</div>

						<div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
							<Field label="Merchant" htmlFor="tx-merchant">
								<Input
									id="tx-merchant"
									value={formData.merchant}
									onChange={(e) => set("merchant", e.target.value)}
									placeholder="Optional"
									disabled={isLoading}
								/>
							</Field>
							<Field label="Category">
								<CategoryPicker
									value={
										formData.categoryId
											? BigInt(formData.categoryId)
											: undefined
									}
									onChange={(c) => set("categoryId", c?.id.toString() ?? "")}
								>
									<Button
										type="button"
										variant="outline"
										className="w-full justify-start font-normal"
										disabled={isLoading}
									>
										{(() => {
											const c = categories.find(
												(x) => x.id.toString() === formData.categoryId,
											);
											return c ? (
												<>
													<span
														className="size-2 rounded-full"
														style={{ backgroundColor: c.color }}
													/>
													{c.slug}
												</>
											) : (
												<span className="text-muted-foreground">None</span>
											);
										})()}
									</Button>
								</CategoryPicker>
								<Button
									type="button"
									variant="link"
									size="sm"
									className="h-auto p-0"
									onClick={() => setCreateCategoryOpen(true)}
								>
									New category
								</Button>
							</Field>
						</div>

						<Field label="Notes" htmlFor="tx-notes">
							<Input
								id="tx-notes"
								value={formData.userNotes}
								onChange={(e) => set("userNotes", e.target.value)}
								placeholder="Optional"
								disabled={isLoading}
							/>
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
		</>
	);
}
