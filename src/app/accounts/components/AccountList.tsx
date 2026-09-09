"use client";

import { useEffect, useState } from "react";
import { Card, HStack, Muted, Text, VStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Account } from "@/gen/nagomi/v1/account_pb";
import { AccountType } from "@/gen/nagomi/v1/enums_pb";

interface AccountListProps {
	accounts: Account[];
	onEdit: (account: Account) => void;
	onDelete: (accountId: bigint) => void;
	onSetAnchorBalance: (
		accountId: bigint,
		balance: { currencyCode: string; units: string; nanos: number },
	) => void;
	onUpdateAccount: (
		accountId: bigint,
		data: {
			name: string;
			bank: string;
			type: AccountType;
			friendlyName?: string;
		},
	) => void;
	getAccountTypeName: (type: AccountType) => string;
	isLoading: boolean;
}

export default function AccountList({
	accounts,
	onDelete,
	onSetAnchorBalance,
	getAccountTypeName,
	isLoading,
}: AccountListProps) {
	const [deleteConfirmation, setDeleteConfirmation] = useState<bigint | null>(
		null,
	);
	const [editingAccount, setEditingAccount] = useState<bigint | null>(null);
	const [editingAnchor, setEditingAnchor] = useState<bigint | null>(null);
	const [balances, setBalances] = useState<
		Map<string, { currencyCode: string; units: bigint; nanos: number }>
	>(new Map());

	// Fetch current balances for all accounts
	useEffect(() => {
		const fetchBalances = async () => {
			const newBalances = new Map();
			for (const account of accounts) {
				try {
					const response = await fetch(
						"/api/nagomi.v1.AccountService/GetAccountBalance",
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ id: parseInt(account.id.toString(), 10) }),
						},
					);
					if (response.ok) {
						const data = await response.json();
						if (data.balance) {
							newBalances.set(account.id.toString(), data.balance);
						}
					}
				} catch (error) {
					console.warn(
						`Failed to fetch balance for account ${account.id}:`,
						error,
					);
				}
			}
			setBalances(newBalances);
		};

		if (accounts.length > 0) {
			fetchBalances();
		}
	}, [accounts]);
	const formatBalance = (balance?: {
		currencyCode?: string;
		units?: string | bigint;
		nanos?: number;
	}) => {
		if (!balance?.units) return "—";

		// Convert units to number and add nanos (fractional part)
		const unitsAmount = parseFloat(balance.units.toString());
		const nanosAmount = (balance.nanos || 0) / 1e9; // Convert nanos to decimal
		const totalAmount = unitsAmount + nanosAmount;

		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: balance.currencyCode || "USD",
		}).format(totalAmount);
	};

	const getCurrentBalance = (accountId: bigint) => {
		const balance = balances.get(accountId.toString());
		return balance ? formatBalance(balance) : "loading...";
	};

	const formatDate = (timestamp?: {
		seconds?: string | bigint;
		nanos?: number;
	}) => {
		if (!timestamp?.seconds) return "—";
		const seconds =
			typeof timestamp.seconds === "bigint"
				? Number(timestamp.seconds)
				: parseInt(timestamp.seconds, 10);
		return new Date(seconds * 1000).toLocaleDateString();
	};

	const handleDeleteClick = (accountId: bigint) => {
		if (deleteConfirmation === accountId) {
			// Second click - actually delete
			onDelete(accountId);
			setDeleteConfirmation(null);
		} else {
			// First click - show confirmation
			setDeleteConfirmation(accountId);
		}
	};

	return (
		<VStack spacing="md">
			{accounts.map((account) => (
				<Card key={account.id.toString()} padding="md">
					<VStack spacing="md">
						{/* Main account info */}
						<HStack
							spacing="lg"
							justify="between"
							align="start"
							className="w-full"
						>
							<VStack spacing="xs" align="start" className="flex-1">
								{editingAccount === account.id ? (
									<VStack spacing="sm" className="w-full">
										<Input
											defaultValue={account.friendlyName || account.name}
											placeholder="Account display name"
											className="font-medium"
										/>
										<HStack spacing="sm" className="w-full">
											<Input
												defaultValue={account.name}
												placeholder="Internal name"
												className="text-sm"
											/>
											<Input
												defaultValue={account.bank}
												placeholder="Bank"
												className="text-sm"
											/>
											<select
												defaultValue={account.type.toString()}
												className="rounded-sm border border-input bg-transparent px-3 py-2 text-sm"
											>
												<option value={AccountType.ACCOUNT_CHEQUING}>
													chequing
												</option>
												<option value={AccountType.ACCOUNT_SAVINGS}>
													savings
												</option>
												<option value={AccountType.ACCOUNT_CREDIT_CARD}>
													credit card
												</option>
												<option value={AccountType.ACCOUNT_INVESTMENT}>
													investment
												</option>
												<option value={AccountType.ACCOUNT_OTHER}>other</option>
												<option value={AccountType.ACCOUNT_FRIEND}>
													friend
												</option>
											</select>
										</HStack>
									</VStack>
								) : (
									<VStack spacing="xs" align="start">
										<HStack spacing="sm" align="center">
											<Text weight="medium" size="lg">
												{account.friendlyName || account.name}
											</Text>
											{account.friendlyName && (
												<Muted size="sm">({account.name})</Muted>
											)}
										</HStack>
										<Text size="sm" color="muted">
											{account.bank} • {getAccountTypeName(account.type)}
										</Text>
									</VStack>
								)}
							</VStack>

							<VStack spacing="xs" align="end">
								<Text size="lg" weight="bold" className="font-mono">
									{getCurrentBalance(account.id)}
								</Text>
								<Muted size="xs">current balance</Muted>
							</VStack>
						</HStack>

						{/* Anchor balance info */}
						{account.anchorBalance && (
							<Card
								variant="subtle"
								padding="sm"
								className="border-l-2 border-primary/20 w-full"
							>
								<HStack
									spacing="lg"
									justify="between"
									align="center"
									className="w-full"
								>
									<VStack spacing="xs" align="start">
										<Muted size="xs">anchor balance</Muted>
										{editingAnchor === account.id ? (
											<HStack spacing="sm" align="center">
												<Input
													type="number"
													step="0.01"
													defaultValue={
														parseFloat(
															account.anchorBalance.units?.toString() || "0",
														) +
														(account.anchorBalance.nanos || 0) / 1e9
													}
													className="w-24 h-7 text-sm"
												/>
												<select
													defaultValue={
														account.anchorBalance.currencyCode || "USD"
													}
													className="h-7 text-sm rounded-sm border border-input bg-transparent px-2"
												>
													<option value="USD">USD</option>
													<option value="CAD">CAD</option>
													<option value="EUR">EUR</option>
													<option value="GBP">GBP</option>
													<option value="JPY">JPY</option>
												</select>
												<Button size="sm" className="h-7 text-xs">
													save
												</Button>
												<Button
													size="sm"
													variant="ghost"
													className="h-7 text-xs"
													onClick={() => setEditingAnchor(null)}
												>
													cancel
												</Button>
											</HStack>
										) : (
											<button
												onClick={() => setEditingAnchor(account.id)}
												className="text-sm hover:underline text-primary"
											>
												{formatBalance(account.anchorBalance)}
											</button>
										)}
									</VStack>
									<Muted size="xs">
										{account.anchorDate && formatDate(account.anchorDate)}
									</Muted>
								</HStack>
							</Card>
						)}

						{/* Action buttons */}
						<HStack spacing="sm" className="flex-wrap">
							{editingAccount === account.id ? (
								<>
									<Button size="sm" onClick={() => setEditingAccount(null)}>
										save changes
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => setEditingAccount(null)}
									>
										cancel
									</Button>
								</>
							) : (
								<>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => setEditingAccount(account.id)}
										disabled={isLoading}
									>
										edit
									</Button>
									{!account.anchorBalance && (
										<Button
											size="sm"
											variant="outline"
											onClick={() =>
												onSetAnchorBalance(account.id, {
													currencyCode: "USD",
													units: "0",
													nanos: 0,
												})
											}
											disabled={isLoading}
											className="text-primary hover:bg-primary/10 border-primary/20"
										>
											set anchor balance
										</Button>
									)}
									<Button
										size="sm"
										variant={
											deleteConfirmation === account.id
												? "destructive"
												: "ghost"
										}
										onClick={() => handleDeleteClick(account.id)}
										className={
											deleteConfirmation === account.id
												? "min-h-8"
												: "text-destructive hover:bg-destructive/10 border-destructive/50"
										}
										disabled={isLoading}
									>
										{deleteConfirmation === account.id
											? "confirm delete"
											: "delete"}
									</Button>
								</>
							)}
						</HStack>
					</VStack>
				</Card>
			))}
		</VStack>
	);
}
