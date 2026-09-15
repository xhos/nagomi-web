"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ColorSwatch } from "@/components/ui/color-swatch";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormError, NativeSelect } from "@/components/ui/forms";
import { Input } from "@/components/ui/input";
import type { Account } from "@/gen/nagomi/v1/account_pb";
import { AccountType } from "@/gen/nagomi/v1/enums_pb";
import {
	useAccountHasTransactions,
	useAddAccountAlias,
	useRemoveAccountAlias,
} from "@/hooks/useAccounts";
import { useCurrencies } from "@/hooks/useCurrencies";
import { ACCOUNT_TYPES } from "@/lib/utils/account";

export interface AccountFormData {
	name: string;
	bank: string;
	type: AccountType;
	friendlyName?: string;
	anchorBalance?: { currencyCode: string; units: string; nanos: number };
	mainCurrency?: string;
	colors?: string[];
}

interface AccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account?: Account | null;
	onSave: (data: AccountFormData) => Promise<void>;
}

const DEFAULT_COLORS = ["#1f2937", "#3b82f6", "#10b981"];

export function AccountDialog({
	open,
	onOpenChange,
	account,
	onSave,
}: AccountDialogProps) {
	const { currencies } = useCurrencies();
	const { addAliasAsync } = useAddAccountAlias();
	const { removeAliasAsync } = useRemoveAccountAlias();
	const { data: hasTransactions } = useAccountHasTransactions(
		account?.id ?? null,
	);

	const [name, setName] = useState("");
	const [friendlyName, setFriendlyName] = useState("");
	const [bank, setBank] = useState("");
	const [type, setType] = useState<AccountType>(AccountType.ACCOUNT_CHEQUING);
	const [mainCurrency, setMainCurrency] = useState("USD");
	const [colors, setColors] = useState(DEFAULT_COLORS);
	const [initialBalance, setInitialBalance] = useState("0");
	const [aliases, setAliases] = useState<string[]>([]);
	const [newAlias, setNewAlias] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setName(account?.name ?? "");
		setFriendlyName(account?.friendlyName ?? "");
		setBank(account?.bank ?? "");
		setType(account?.type ?? AccountType.ACCOUNT_CHEQUING);
		setMainCurrency(account?.mainCurrency || "USD");
		setColors(account?.colors.length ? account.colors : DEFAULT_COLORS);
		setInitialBalance("0");
		setAliases(account?.aliases.filter((a) => a !== account.name) ?? []);
		setNewAlias("");
		setError(null);
	}, [account, open]);

	const addAlias = async () => {
		const alias = newAlias.trim();
		if (!account || !alias || aliases.includes(alias)) return;
		setNewAlias("");
		await addAliasAsync({ accountId: account.id, alias });
		setAliases((a) => [...a, alias]);
	};
	const removeAlias = async (alias: string) => {
		if (!account) return;
		await removeAliasAsync({ accountId: account.id, alias });
		setAliases((a) => a.filter((x) => x !== alias));
	};

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name || !bank) {
			setError("Name and bank are required.");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const data: AccountFormData = {
				name,
				bank,
				type,
				friendlyName: friendlyName || undefined,
				mainCurrency:
					account && mainCurrency === account.mainCurrency
						? undefined
						: mainCurrency,
				colors,
			};
			if (!account) {
				const n = Number(initialBalance || "0");
				data.anchorBalance = {
					currencyCode: mainCurrency,
					units: Math.trunc(n).toString(),
					nanos: Math.round((n - Math.trunc(n)) * 1e9),
				};
			}
			await onSave(data);
			onOpenChange(false);
		} catch (err) {
			const m = err instanceof Error ? err.message : "Couldn't save account";
			setError(
				m.includes("duplicate key")
					? "An account with this name already exists."
					: m,
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[520px]">
				<form onSubmit={submit} className="space-y-4">
					<DialogHeader>
						<DialogTitle>
							{account ? "edit account" : "new account"}
						</DialogTitle>
					</DialogHeader>

					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Name" htmlFor="acct-name">
							<Input
								id="acct-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="As it appears at the bank"
								required
								autoFocus
							/>
						</Field>
						<Field label="Bank" htmlFor="acct-bank">
							<Input
								id="acct-bank"
								value={bank}
								onChange={(e) => setBank(e.target.value)}
								required
							/>
						</Field>
						<Field label="Type" htmlFor="acct-type">
							<NativeSelect
								id="acct-type"
								value={type}
								onChange={(e) => setType(Number(e.target.value) as AccountType)}
							>
								{ACCOUNT_TYPES.map(([t, label]) => (
									<option key={t} value={t}>
										{label}
									</option>
								))}
							</NativeSelect>
						</Field>
						<Field
							label="Currency"
							htmlFor="acct-currency"
							hint={
								hasTransactions
									? "Can't change once the account has transactions."
									: undefined
							}
						>
							<NativeSelect
								id="acct-currency"
								value={mainCurrency}
								onChange={(e) => setMainCurrency(e.target.value)}
								disabled={!!hasTransactions}
							>
								{currencies.map(({ code }) => (
									<option key={code} value={code}>
										{code}
									</option>
								))}
							</NativeSelect>
						</Field>
						<Field label="Display name" htmlFor="acct-friendly">
							<Input
								id="acct-friendly"
								value={friendlyName}
								onChange={(e) => setFriendlyName(e.target.value)}
								placeholder="Optional"
							/>
						</Field>
						<Field label="Colors">
							<div className="flex h-9 items-center gap-2">
								{colors.map((color, i) => (
									<ColorSwatch
										key={`${i}-${color}`}
										color={color}
										onChange={(c) =>
											setColors((cs) => cs.map((x, j) => (j === i ? c : x)))
										}
									/>
								))}
							</div>
						</Field>
						{!account && (
							<Field label="Starting balance" htmlFor="acct-balance">
								<Input
									id="acct-balance"
									type="number"
									step="0.01"
									value={initialBalance}
									onChange={(e) => setInitialBalance(e.target.value)}
								/>
							</Field>
						)}
					</div>

					{account && (
						<Field
							label="Aliases"
							hint="Other names this account appears under in imports."
						>
							<div className="flex flex-wrap items-center gap-2">
								{aliases.map((alias) => (
									<span
										key={alias}
										className="flex h-7 items-center gap-1 rounded-md border pr-1 pl-2 text-sm"
									>
										{alias}
										<button
											type="button"
											aria-label={`Remove ${alias}`}
											onClick={() => removeAlias(alias)}
											className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
										>
											<X className="size-3" />
										</button>
									</span>
								))}
								<Input
									value={newAlias}
									onChange={(e) => setNewAlias(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											addAlias();
										}
									}}
									onBlur={addAlias}
									placeholder="Add alias"
									className="h-7 w-36"
								/>
							</div>
						</Field>
					)}

					<FormError>{error}</FormError>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={saving}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={saving}>
							{saving ? "Saving…" : "Save"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
