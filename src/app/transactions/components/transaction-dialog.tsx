"use client";

import * as React from "react";
import { CategoryDialog } from "@/app/categories/category-dialog";
import { ErrorMessage, VStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories, useCreateCategory } from "@/hooks/useCategories";
import { useCurrencies } from "@/hooks/useCurrencies";

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
		categoryId?: bigint;
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
			setError("please select an account");
			return;
		}

		if (!formData.amount || parseFloat(formData.amount) <= 0) {
			setError("please enter a valid amount");
			return;
		}

		if (!formData.description.trim()) {
			setError("please enter a description");
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
				categoryId: formData.categoryId
					? BigInt(formData.categoryId)
					: undefined,
			});
			onOpenChange(false);
		} catch (err) {
			const message = err instanceof Error ? err.message : undefined;
			setError(message || "failed to save transaction");
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
				title="new category"
				onSave={async (slug, color) => {
					await createCategoryAsync({ slug, color });
					setPendingCategorySlug(slug);
				}}
			/>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-[520px]">
					<form onSubmit={handleSubmit}>
						<DialogHeader>
							<DialogTitle>{title}</DialogTitle>
						</DialogHeader>

						<VStack spacing="md" className="py-4">
							{/* core: account, type, amount, date */}
							<div className="grid grid-cols-[1fr_auto] gap-3">
								<VStack spacing="xs">
									<Label>account *</Label>
									<Select
										value={formData.accountId}
										onValueChange={(value) => {
											const selectedAccount = accounts.find(
												(a) => a.id.toString() === value,
											);
											setFormData((prev) => ({
												...prev,
												accountId: value,
												currency:
													selectedAccount?.mainCurrency || prev.currency,
											}));
										}}
										disabled={isLoading}
										required
									>
										<SelectTrigger>
											<SelectValue placeholder="select account" />
										</SelectTrigger>
										<SelectContent>
											{accounts.map((account) => (
												<SelectItem
													key={account.id.toString()}
													value={account.id.toString()}
												>
													{account.friendlyName || account.name} ({account.bank}
													)
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</VStack>

								<VStack spacing="xs">
									<Label>type</Label>
									<Select
										value={formData.direction.toString()}
										onValueChange={(value) =>
											set(
												"direction",
												parseInt(value, 10) as TransactionDirection,
											)
										}
										disabled={isLoading}
									>
										<SelectTrigger className="w-28">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem
												value={TransactionDirection.DIRECTION_OUTGOING.toString()}
											>
												expense
											</SelectItem>
											<SelectItem
												value={TransactionDirection.DIRECTION_INCOMING.toString()}
											>
												income
											</SelectItem>
										</SelectContent>
									</Select>
								</VStack>
							</div>

							<VStack spacing="xs">
								<Label>amount *</Label>
								<div className="flex">
									<Select
										value={formData.currency}
										onValueChange={(value) => set("currency", value)}
										disabled={isLoading}
									>
										<SelectTrigger className="w-24 rounded-r-none border-r-0 focus:z-10">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{currencies.map(({ code }) => (
												<SelectItem key={code} value={code}>
													{code}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Input
										type="number"
										step="0.01"
										value={formData.amount}
										onChange={(e) => set("amount", e.target.value)}
										placeholder="0.00"
										disabled={isLoading}
										required
										className="rounded-l-none font-mono"
									/>
								</div>
							</VStack>

							<VStack spacing="xs">
								<Label>description *</Label>
								<Input
									value={formData.description}
									onChange={(e) => set("description", e.target.value)}
									placeholder="what was this for"
									disabled={isLoading}
								/>
							</VStack>

							<div className="grid grid-cols-[1fr_auto] gap-3">
								<VStack spacing="xs">
									<Label>date *</Label>
									<Input
										type="text"
										value={formData.date}
										onChange={(e) => set("date", e.target.value)}
										placeholder="YYYY-MM-DD"
										disabled={isLoading}
										className="font-mono"
									/>
								</VStack>
								<VStack spacing="xs">
									<Label>time</Label>
									<Input
										type="text"
										value={formData.time}
										onChange={(e) => set("time", e.target.value)}
										placeholder="HH:MM"
										disabled={isLoading}
										className="w-24 font-mono"
									/>
								</VStack>
							</div>

							<Separator />

							{/* metadata: merchant, category, notes */}
							<VStack spacing="xs">
								<Label>merchant</Label>
								<Input
									value={formData.merchant}
									onChange={(e) => set("merchant", e.target.value)}
									placeholder="who was this with"
									disabled={isLoading}
								/>
							</VStack>

							<VStack spacing="xs">
								<Label>category</Label>
								<Select
									value={formData.categoryId || "_none"}
									onValueChange={(value) => {
										if (value === "_create_new") {
											setCreateCategoryOpen(true);
											return;
										}
										set("categoryId", value === "_none" ? "" : value);
									}}
									disabled={isLoading}
								>
									<SelectTrigger>
										<SelectValue placeholder="no category" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="_none">no category</SelectItem>
										{categories.map(
											(category: { id: bigint; slug: string }) => (
												<SelectItem
													key={category.id.toString()}
													value={category.id.toString()}
												>
													{category.slug}
												</SelectItem>
											),
										)}
										<SelectItem
											value="_create_new"
											className="text-muted-foreground"
										>
											+ new category
										</SelectItem>
									</SelectContent>
								</Select>
							</VStack>

							<VStack spacing="xs">
								<Label>notes</Label>
								<Input
									value={formData.userNotes}
									onChange={(e) => set("userNotes", e.target.value)}
									placeholder="personal notes"
									disabled={isLoading}
								/>
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
								cancel
							</Button>
							<Button type="submit" disabled={isLoading}>
								{isLoading ? "saving..." : "save"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
