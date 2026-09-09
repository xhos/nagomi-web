"use client";

import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ErrorMessage, HStack, VStack } from "@/components/lib";
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
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
import { useCurrencies } from "@/hooks/useCurrencies";

interface AccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account?: Account | null;
	onSave: (data: {
		name: string;
		bank: string;
		type: AccountType;
		friendlyName?: string;
		anchorBalance?: { currencyCode: string; units: string; nanos: number };
		mainCurrency?: string;
		colors?: string[];
	}) => Promise<void>;
	title: string;
}

export function AccountDialog({
	open,
	onOpenChange,
	account,
	onSave,
	title,
}: AccountDialogProps) {
	const [name, setName] = useState("");
	const [friendlyName, setFriendlyName] = useState("");
	const [bank, setBank] = useState("");
	const [type, setType] = useState<AccountType>(AccountType.ACCOUNT_CHEQUING);
	const { currencies } = useCurrencies();
	const [mainCurrency, setMainCurrency] = useState("");
	const [colors, setColors] = useState(["#1f2937", "#3b82f6", "#10b981"]);
	const [initialBalance, setInitialBalance] = useState("0");
	const [aliases, setAliases] = useState<string[]>([]);
	const [newAlias, setNewAlias] = useState("");
	const [isAddingAlias, setIsAddingAlias] = useState(false);
	const [justAddedAlias, setJustAddedAlias] = useState<string | null>(null);
	const aliasInputRef = useRef<HTMLInputElement>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { addAliasAsync } = useAddAccountAlias();
	const { removeAliasAsync } = useRemoveAccountAlias();
	const { data: hasTransactions } = useAccountHasTransactions(
		account?.id ?? null,
	);

	useEffect(() => {
		if (open) {
			if (account) {
				setName(account.name);
				setFriendlyName(account.friendlyName || "");
				setBank(account.bank);
				setType(account.type);
				setMainCurrency(account.mainCurrency ?? "");
				setColors(
					account.colors.length > 0
						? account.colors
						: ["#1f2937", "#3b82f6", "#10b981"],
				);
				setInitialBalance("0");
				setAliases(account.aliases.filter((a) => a !== account.name));
			} else {
				setName("");
				setFriendlyName("");
				setBank("");
				setType(AccountType.ACCOUNT_CHEQUING);
				setMainCurrency("USD");
				setColors(["#1f2937", "#3b82f6", "#10b981"]);
				setInitialBalance("0");
				setAliases([]);
			}
			setNewAlias("");
			setIsAddingAlias(false);
			setJustAddedAlias(null);
			setError(null);
		}
	}, [account, open]);

	useEffect(() => {
		if (isAddingAlias) aliasInputRef.current?.focus();
	}, [isAddingAlias]);

	const handleAddAlias = async () => {
		if (!account || !newAlias.trim()) return;
		if (aliases.includes(newAlias.trim())) return;
		const aliasToAdd = newAlias.trim();
		setNewAlias("");
		setIsAddingAlias(false);
		setJustAddedAlias(aliasToAdd);
		await addAliasAsync({ accountId: account.id, alias: aliasToAdd });
		setAliases((prev) => [...prev, aliasToAdd]);
		setTimeout(() => setJustAddedAlias(null), 300);
	};

	const handleRemoveAlias = async (alias: string) => {
		if (!account) return;
		await removeAliasAsync({ accountId: account.id, alias });
		setAliases((prev) => prev.filter((a) => a !== alias));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!name || !bank) {
			setError("Name and bank are required");
			return;
		}

		setIsLoading(true);
		try {
			const data: Parameters<typeof onSave>[0] = {
				name,
				bank,
				type,
				friendlyName: friendlyName || undefined,
				mainCurrency:
					account && mainCurrency === (account.mainCurrency ?? "")
						? undefined
						: mainCurrency,
				colors,
			};

			if (!account) {
				data.anchorBalance = {
					currencyCode: mainCurrency,
					units: Math.floor(parseFloat(initialBalance || "0")).toString(),
					nanos: Math.round((parseFloat(initialBalance || "0") % 1) * 1e9),
				};
			}

			await onSave(data);
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save account");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[540px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
					</DialogHeader>
					<VStack spacing="md" className="py-4">
						<div className="grid grid-cols-2 gap-3">
							<VStack spacing="xs">
								<Label htmlFor="name">name *</Label>
								<Input
									id="name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="my checking account"
									disabled={isLoading}
									required
								/>
							</VStack>
							<VStack spacing="xs">
								<Label htmlFor="bank">bank *</Label>
								<Input
									id="bank"
									value={bank}
									onChange={(e) => setBank(e.target.value)}
									placeholder="chase"
									disabled={isLoading}
									required
								/>
							</VStack>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<VStack spacing="xs">
								<Label htmlFor="type">type</Label>
								<Select
									value={type.toString()}
									onValueChange={(value) =>
										setType(parseInt(value, 10) as AccountType)
									}
									disabled={isLoading}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={AccountType.ACCOUNT_CHEQUING.toString()}>
											chequing
										</SelectItem>
										<SelectItem value={AccountType.ACCOUNT_SAVINGS.toString()}>
											savings
										</SelectItem>
										<SelectItem
											value={AccountType.ACCOUNT_CREDIT_CARD.toString()}
										>
											credit card
										</SelectItem>
										<SelectItem
											value={AccountType.ACCOUNT_INVESTMENT.toString()}
										>
											investment
										</SelectItem>
										<SelectItem value={AccountType.ACCOUNT_OTHER.toString()}>
											other
										</SelectItem>
										<SelectItem value={AccountType.ACCOUNT_FRIEND.toString()}>
											friend
										</SelectItem>
									</SelectContent>
								</Select>
							</VStack>
							<VStack spacing="xs">
								<Label htmlFor="currency">currency</Label>
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<div>
												<Select
													value={mainCurrency}
													onValueChange={setMainCurrency}
													disabled={isLoading || !!hasTransactions}
												>
													<SelectTrigger>
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
											</div>
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
						</div>

						<div className="flex gap-3 items-end">
							<VStack spacing="xs" className="flex-1">
								<Label htmlFor="friendlyName">friendly name</Label>
								<Input
									id="friendlyName"
									value={friendlyName}
									onChange={(e) => setFriendlyName(e.target.value)}
									placeholder="display name (optional)"
									disabled={isLoading}
								/>
							</VStack>
							<VStack spacing="xs">
								<Label>colors</Label>
								<HStack spacing="xs" className="h-9 items-center">
									{colors.map((color, index) => (
										<ColorSwatch
											key={index}
											color={color}
											onChange={(newColor) => {
												const newColors = [...colors];
												newColors[index] = newColor;
												setColors(newColors);
											}}
											disabled={isLoading}
										/>
									))}
								</HStack>
							</VStack>
						</div>

						{!account && (
							<VStack spacing="xs">
								<Label htmlFor="initialBalance">initial balance</Label>
								<Input
									id="initialBalance"
									type="number"
									step="0.01"
									value={initialBalance}
									onChange={(e) => setInitialBalance(e.target.value)}
									placeholder="0.00"
									disabled={isLoading}
									required
								/>
							</VStack>
						)}

						{account && (
							<VStack spacing="xs" className="min-w-0">
								<Label>aliases</Label>
								<div className="flex flex-wrap gap-1.5">
									{aliases.map((alias) => (
										<div
											key={alias}
											className={`flex items-center gap-1 rounded border px-2 py-1 shrink-0 ${justAddedAlias === alias ? "animate-in fade-in duration-200" : ""}`}
											onAuxClick={(e) =>
												e.button === 1 && handleRemoveAlias(alias)
											}
										>
											<span className="text-sm font-mono">{alias}</span>
											<button
												type="button"
												onClick={() => handleRemoveAlias(alias)}
												disabled={isLoading}
												className="text-muted-foreground hover:text-destructive transition-colors duration-150"
											>
												<X className="h-3 w-3" />
											</button>
										</div>
									))}
									<div
										className={`relative flex items-center overflow-hidden rounded transition-all duration-200 ease-in-out ${
											isAddingAlias ? "border gap-1 px-2 py-1 w-36" : "w-6 h-6"
										}`}
									>
										<span
											className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${
												isAddingAlias
													? "opacity-0 pointer-events-none"
													: "opacity-100"
											}`}
										>
											<button
												type="button"
												onClick={() => setIsAddingAlias(true)}
												disabled={isLoading}
												className="text-muted-foreground hover:text-foreground transition-colors duration-150"
											>
												<span className="text-base leading-none">+</span>
											</button>
										</span>
										<span
											className={`flex items-center gap-1 transition-opacity duration-150 ${
												isAddingAlias
													? "opacity-100"
													: "opacity-0 pointer-events-none"
											}`}
										>
											<input
												ref={aliasInputRef}
												value={newAlias}
												onChange={(e) => setNewAlias(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														e.preventDefault();
														handleAddAlias();
													}
													if (e.key === "Escape") {
														setIsAddingAlias(false);
														setNewAlias("");
													}
												}}
												onBlur={() => {
													if (!newAlias.trim()) {
														setIsAddingAlias(false);
													}
												}}
												placeholder="alias"
												disabled={isLoading}
												className="text-sm font-mono bg-transparent outline-none w-full placeholder:text-muted-foreground"
											/>
											<button
												type="button"
												onMouseDown={(e) => {
													e.preventDefault();
													handleAddAlias();
												}}
												disabled={isLoading || !newAlias.trim()}
												className="text-muted-foreground hover:text-foreground transition-colors duration-150 disabled:opacity-30 shrink-0"
											>
												<Check className="h-3 w-3" />
											</button>
										</span>
									</div>
								</div>
							</VStack>
						)}

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
	);
}
