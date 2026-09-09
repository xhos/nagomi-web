"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Caption, HStack, Muted, Text, VStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Account } from "@/gen/nagomi/v1/account_pb";
import { AccountType } from "@/gen/nagomi/v1/enums_pb";
import {
	useAccountHasTransactions,
	useAddAccountAlias,
	useRemoveAccountAlias,
} from "@/hooks/useAccounts";

interface EditAccountSidebarProps {
	account: Account | null;
	onClose: () => void;
	onUpdate: (
		accountId: bigint,
		data: {
			name: string;
			bank: string;
			type: AccountType;
			friendlyName?: string;
			mainCurrency?: string;
			colors?: string[];
		},
	) => void;
	onDelete: (accountId: bigint) => void;
	onSetAnchorBalance: (
		accountId: bigint,
		balance: { currencyCode: string; units: string; nanos: number },
	) => void;
	getAccountTypeName: (type: AccountType) => string;
	isLoading: boolean;
}

export default function EditAccountSidebar({
	account,
	onClose,
	onUpdate,
	onDelete,
	onSetAnchorBalance,
	isLoading,
}: EditAccountSidebarProps) {
	const [deleteConfirmation, setDeleteConfirmation] = useState(false);
	const [aliases, setAliases] = useState<string[]>([]);
	const [newAlias, setNewAlias] = useState("");
	const { addAliasAsync } = useAddAccountAlias();
	const { removeAliasAsync } = useRemoveAccountAlias();
	const { data: hasTransactions } = useAccountHasTransactions(account?.id);

	const [editForm, setEditForm] = useState({
		name: "",
		bank: "",
		type: AccountType.ACCOUNT_UNSPECIFIED,
		friendlyName: "",
		mainCurrency: "",
		anchorBalance: "",
		colors: ["#1f2937", "#3b82f6", "#10b981"],
	});

	useEffect(() => {
		if (!account) return;

		setEditForm({
			name: account.name,
			bank: account.bank,
			type: account.type,
			friendlyName: account.friendlyName || "",
			mainCurrency: account.mainCurrency || "USD",
			anchorBalance: account.anchorBalance
				? (
						parseFloat(account.anchorBalance.units?.toString() || "0") +
						(account.anchorBalance.nanos || 0) / 1e9
					).toString()
				: "",
			colors:
				account.colors.length === 3
					? account.colors
					: ["#1f2937", "#3b82f6", "#10b981"],
		});
		setAliases(account.aliases);
		setNewAlias("");

		// Reset delete confirmation when account changes
		setDeleteConfirmation(false);
	}, [account]);

	// Reset delete confirmation when sidebar closes
	useEffect(() => {
		if (!account) {
			setDeleteConfirmation(false);
		}
	}, [account]);

	const handleAddAlias = async () => {
		if (!account || !newAlias.trim()) return;
		if (aliases.includes(newAlias.trim())) return;
		await addAliasAsync({ accountId: account.id, alias: newAlias.trim() });
		setAliases((prev) => [...prev, newAlias.trim()]);
		setNewAlias("");
	};

	const handleRemoveAlias = async (alias: string) => {
		if (!account) return;
		await removeAliasAsync({ accountId: account.id, alias });
		setAliases((prev) => prev.filter((a) => a !== alias));
	};

	const handleDeleteClick = () => {
		if (!account) return;

		if (deleteConfirmation) {
			onDelete(account.id);
			setDeleteConfirmation(false);
			onClose();
		} else {
			setDeleteConfirmation(true);
		}
	};

	const handleSave = () => {
		if (!account) return;

		const updateData = {
			name: editForm.name,
			bank: editForm.bank,
			type: editForm.type,
			friendlyName: editForm.friendlyName,
			mainCurrency: editForm.mainCurrency,
			colors: editForm.colors,
		};

		onUpdate(account.id, updateData);

		// Update anchor balance if it changed
		if (
			editForm.anchorBalance &&
			editForm.anchorBalance !==
				(account.anchorBalance
					? (
							parseFloat(account.anchorBalance.units?.toString() || "0") +
							(account.anchorBalance.nanos || 0) / 1e9
						).toString()
					: "")
		) {
			const anchorBalance = {
				currencyCode: editForm.mainCurrency,
				units: parseFloat(editForm.anchorBalance).toString(),
				nanos: Math.round((parseFloat(editForm.anchorBalance) % 1) * 1e9),
			};

			onSetAnchorBalance(account.id, anchorBalance);
		}
	};

	const handleCancel = () => {
		if (!account) return;

		setEditForm({
			name: account.name,
			bank: account.bank,
			type: account.type,
			friendlyName: account.friendlyName || "",
			mainCurrency: account.mainCurrency || "USD",
			anchorBalance: account.anchorBalance
				? (
						parseFloat(account.anchorBalance.units?.toString() || "0") +
						(account.anchorBalance.nanos || 0) / 1e9
					).toString()
				: "",
			colors:
				account.colors.length === 3
					? account.colors
					: ["#1f2937", "#3b82f6", "#10b981"],
		});
		onClose();
	};

	if (!account) return null;

	return (
		<>
			{/* Backdrop */}
			<div className="fixed inset-0 bg-black/20 z-40" onClick={handleCancel} />

			{/* Sidebar */}
			<div className="fixed right-0 top-0 h-full w-96 bg-background border-l border-border z-50 overflow-y-auto">
				<div className="p-6">
					{/* Header */}
					<HStack
						spacing="md"
						justify="between"
						align="center"
						className="mb-6"
					>
						<Text size="lg" weight="semibold" className="font-mono">
							details
						</Text>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleCancel}
							className="text-muted-foreground hover:text-foreground"
						>
							✕
						</Button>
					</HStack>

					{/* Form */}
					<VStack spacing="lg">
						<VStack spacing="xs">
							<Caption>id</Caption>
							<Text size="sm" className="font-mono">
								{account.id.toString()}
							</Text>
						</VStack>

						<VStack spacing="xs">
							<Caption>name</Caption>
							<Input
								value={editForm.name}
								onChange={(e) =>
									setEditForm({ ...editForm, name: e.target.value })
								}
								className="text-sm h-8"
								required
							/>
						</VStack>

						<VStack spacing="xs">
							<Caption>friendly name</Caption>
							<Input
								value={editForm.friendlyName}
								onChange={(e) =>
									setEditForm({ ...editForm, friendlyName: e.target.value })
								}
								placeholder="Display name (optional)"
								className="text-sm h-8"
							/>
						</VStack>

						<VStack spacing="xs">
							<Caption>aliases</Caption>
							<VStack spacing="xs">
								{aliases.length > 0 && (
									<div className="max-h-36 overflow-y-auto space-y-1">
										{aliases.map((alias) => (
											<HStack
												key={alias}
												spacing="sm"
												justify="between"
												align="center"
												className="rounded border px-3 py-1.5"
											>
												<Muted size="sm" className="font-mono truncate">
													{alias}
												</Muted>
												<button
													type="button"
													onClick={() => handleRemoveAlias(alias)}
													className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors duration-150"
												>
													<X className="h-3.5 w-3.5" />
												</button>
											</HStack>
										))}
									</div>
								)}
								<HStack spacing="sm">
									<Input
										value={newAlias}
										onChange={(e) => setNewAlias(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && handleAddAlias()}
										placeholder="add alias"
										className="text-sm h-8 font-mono"
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleAddAlias}
										disabled={!newAlias.trim()}
										className="h-8"
									>
										add
									</Button>
								</HStack>
							</VStack>
						</VStack>

						<VStack spacing="xs">
							<Caption>bank</Caption>
							<Input
								value={editForm.bank}
								onChange={(e) =>
									setEditForm({ ...editForm, bank: e.target.value })
								}
								className="text-sm h-8"
								required
							/>
						</VStack>

						<VStack spacing="xs">
							<Caption>type</Caption>
							<select
								value={editForm.type.toString()}
								onChange={(e) =>
									setEditForm({
										...editForm,
										type: parseInt(e.target.value, 10) as AccountType,
									})
								}
								className="rounded-sm border border-border bg-background text-sm h-8 px-3"
							>
								<option value={AccountType.ACCOUNT_CHEQUING}>chequing</option>
								<option value={AccountType.ACCOUNT_SAVINGS}>savings</option>
								<option value={AccountType.ACCOUNT_CREDIT_CARD}>
									credit card
								</option>
								<option value={AccountType.ACCOUNT_INVESTMENT}>
									investment
								</option>
								<option value={AccountType.ACCOUNT_OTHER}>other</option>
								<option value={AccountType.ACCOUNT_FRIEND}>friend</option>
							</select>
						</VStack>

						<VStack spacing="xs">
							<Caption>currency</Caption>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<select
											value={editForm.mainCurrency}
											onChange={(e) =>
												setEditForm({
													...editForm,
													mainCurrency: e.target.value,
												})
											}
											disabled={!!hasTransactions}
											className="rounded-sm border border-border bg-background text-sm h-8 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											<option value="USD">USD</option>
											<option value="CAD">CAD</option>
											<option value="EUR">EUR</option>
											<option value="GBP">GBP</option>
											<option value="JPY">JPY</option>
										</select>
									</TooltipTrigger>
									{hasTransactions && (
										<TooltipContent>
											<p>
												cannot change currency on accounts with transactions
											</p>
										</TooltipContent>
									)}
								</Tooltip>
							</TooltipProvider>
						</VStack>

						<VStack spacing="xs">
							<Caption>colors</Caption>
							<VStack spacing="sm">
								{editForm.colors.map((color, index) => (
									<div key={index} className="flex items-center gap-2">
										<input
											type="color"
											value={color}
											onChange={(e) => {
												const newColors = [...editForm.colors];
												newColors[index] = e.target.value;
												setEditForm({ ...editForm, colors: newColors });
											}}
											className="w-8 h-8 rounded border cursor-pointer"
										/>
										<Caption>
											{index === 0
												? "primary"
												: index === 1
													? "secondary"
													: "tertiary"}
										</Caption>
									</div>
								))}
							</VStack>
						</VStack>

						<VStack spacing="xs">
							<Caption>anchor</Caption>
							<Input
								type="number"
								step="0.01"
								value={editForm.anchorBalance}
								onChange={(e) =>
									setEditForm({ ...editForm, anchorBalance: e.target.value })
								}
								placeholder="0.00"
								className="text-sm h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
							/>
							{account.anchorDate && (
								<Text size="xs" color="muted" className="mt-1">
									last set on{" "}
									{new Date(
										parseInt(
											account.anchorDate.seconds?.toString() || "0",
											10,
										) * 1000,
									).toLocaleDateString()}
								</Text>
							)}
						</VStack>

						<VStack spacing="sm" className="pt-4">
							<Button
								size="sm"
								onClick={handleSave}
								disabled={isLoading || !editForm.name || !editForm.bank}
								className="w-full h-8"
							>
								save
							</Button>

							<Button
								size="sm"
								variant="ghost"
								onClick={handleDeleteClick}
								disabled={isLoading}
								className={`w-full h-8 text-destructive hover:bg-destructive/10 ${
									deleteConfirmation
										? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
										: ""
								}`}
							>
								{deleteConfirmation ? "confirm delete" : "delete"}
							</Button>
						</VStack>
					</VStack>
				</div>
			</div>
		</>
	);
}
