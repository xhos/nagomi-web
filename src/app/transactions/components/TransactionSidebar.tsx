"use client";

import { useState } from "react";
import {
	Amount,
	Caption,
	Card,
	Divider,
	HStack,
	Text,
	VStack,
} from "@/components/lib";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Stat } from "@/components/ui/layout";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useTransactionAnalytics } from "@/hooks/useTransactionAnalytics";
import { formatCurrency } from "@/lib/utils/transaction";

interface TransactionSidebarProps {
	transactions: Transaction[];
	onClose: () => void;
	onDeleteSelected: () => Promise<void>;
	onBulkModify: () => void;
}

function SelectionGuide() {
	return (
		<Card title="selection guide" padding="md" className="hidden xl:block">
			<VStack spacing="md">
				<VStack spacing="sm">
					<VStack spacing="xs">
						<Text size="sm" weight="medium">
							individual selection
						</Text>
						<Text size="sm" color="muted" className="flex items-center gap-1.5">
							<KbdGroup>
								<Kbd>Ctrl</Kbd>
							</KbdGroup>{" "}
							+ click transaction
						</Text>
					</VStack>
					<VStack spacing="xs">
						<Text size="sm" weight="medium">
							range selection
						</Text>
						<Text size="sm" color="muted" className="flex items-center gap-1.5">
							<KbdGroup>
								<Kbd>Shift</Kbd>
							</KbdGroup>{" "}
							+ click transaction
						</Text>
					</VStack>
					<VStack spacing="xs">
						<Text size="sm" weight="medium">
							select entire day
						</Text>
						<VStack spacing="xs">
							<Text
								size="sm"
								color="muted"
								className="flex items-center gap-1.5"
							>
								<KbdGroup>
									<Kbd>Ctrl</Kbd>
								</KbdGroup>{" "}
								+ click day header
							</Text>
							<Text
								size="sm"
								color="muted"
								className="flex items-center gap-1.5"
							>
								<KbdGroup>
									<Kbd>Shift</Kbd>
								</KbdGroup>{" "}
								+ click day header
							</Text>
						</VStack>
					</VStack>
				</VStack>
				<Divider />
				<Text size="sm" color="muted" className="block">
					Selected transactions will show analysis here including income,
					expenses, and net totals.
				</Text>
			</VStack>
		</Card>
	);
}

function TransactionAnalytics({
	transactions,
	onClose,
	onDeleteSelected,
	onBulkModify,
}: TransactionSidebarProps) {
	const [isDeleting, setIsDeleting] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const analytics = useTransactionAnalytics(transactions);

	const handleDeleteClick = async () => {
		if (!confirmDelete) {
			setConfirmDelete(true);
			setTimeout(() => setConfirmDelete(false), 3000);
			return;
		}

		try {
			setIsDeleting(true);
			await onDeleteSelected();
		} catch (error) {
			console.error("Failed to delete transactions:", error);
		} finally {
			setIsDeleting(false);
			setConfirmDelete(false);
		}
	};

	return (
		<Card title="selection analysis" padding="md" className="hidden xl:block">
			<VStack spacing="md">
				<VStack spacing="xs">
					<HStack spacing="md" justify="between" align="center">
						<Text size="sm" color="muted">
							{analytics.transactionCount} transaction
							{analytics.transactionCount !== 1 ? "s" : ""} selected
						</Text>
						<button
							onClick={onClose}
							className="text-muted-foreground hover:text-foreground transition-colors"
						>
							✕
						</button>
					</HStack>
				</VStack>

				<Divider />

				<VStack spacing="sm">
					<Stat
						label="income"
						value={
							<Amount
								variant="positive"
								value={analytics.totalIncome}
								className="text-sm"
							/>
						}
					/>
					<Stat
						label="expenses"
						value={
							<Amount
								variant="negative"
								value={analytics.totalExpenses}
								className="text-sm"
							/>
						}
					/>
				</VStack>

				<Divider />

				<Stat
					label="net amount"
					value={
						<Amount
							variant={analytics.netAmount >= 0 ? "positive" : "negative"}
							value={analytics.netAmount}
							className="text-sm font-semibold"
						/>
					}
				/>

				<Divider />

				<VStack spacing="sm">
					<Caption>summary</Caption>
					<VStack spacing="xs">
						<Stat
							label="Average per transaction"
							value={
								<span className="font-mono">
									{formatCurrency(
										analytics.netAmount / analytics.transactionCount,
									)}
								</span>
							}
						/>
						{analytics.totalIncome > 0 && (
							<Stat
								label="Income percentage"
								value={
									<span className="font-mono text-xs text-success">
										{analytics.incomePercentage.toFixed(1)}%
									</span>
								}
							/>
						)}
						{analytics.totalExpenses > 0 && (
							<Stat
								label="Expense percentage"
								value={
									<span className="font-mono text-xs text-destructive">
										{analytics.expensePercentage.toFixed(1)}%
									</span>
								}
							/>
						)}
					</VStack>
				</VStack>

				<Divider />

				<VStack spacing="sm">
					<Caption>actions</Caption>
					<VStack spacing="xs">
						<Button onClick={onBulkModify} className="w-full" size="sm">
							bulk modify
						</Button>
						<Button
							onClick={handleDeleteClick}
							disabled={isDeleting}
							variant={confirmDelete ? "destructive" : "outline"}
							className="w-full"
							size="sm"
						>
							{isDeleting
								? "Deleting..."
								: confirmDelete
									? `Confirm delete ${transactions.length}?`
									: "delete selected"}
						</Button>
					</VStack>
				</VStack>
			</VStack>
		</Card>
	);
}

export function TransactionSidebar({
	transactions,
	onClose,
	onDeleteSelected,
	onBulkModify,
}: TransactionSidebarProps) {
	if (transactions.length === 0) {
		return <SelectionGuide />;
	}

	return (
		<TransactionAnalytics
			transactions={transactions}
			onClose={onClose}
			onDeleteSelected={onDeleteSelected}
			onBulkModify={onBulkModify}
		/>
	);
}
