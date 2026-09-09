"use client";

import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { Card, HStack, Mono, Muted, Text, VStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Account } from "@/gen/nagomi/v1/account_pb";
import type { AccountType } from "@/gen/nagomi/v1/enums_pb";

interface DeleteAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account: Account | null;
	getAccountTypeName: (type: AccountType) => string;
	onConfirm: () => Promise<void>;
}

export function DeleteAccountDialog({
	open,
	onOpenChange,
	account,
	getAccountTypeName,
	onConfirm,
}: DeleteAccountDialogProps) {
	const [isLoading, setIsLoading] = useState(false);

	const handleConfirm = async () => {
		setIsLoading(true);
		try {
			await onConfirm();
			onOpenChange(false);
		} catch (error) {
			console.error("Failed to delete account:", error);
		} finally {
			setIsLoading(false);
		}
	};

	if (!account) return null;

	const formatBalance = (balance?: {
		currencyCode?: string;
		units?: string | bigint;
		nanos?: number;
	}) => {
		if (!balance) return "$0.00";

		const unitsAmount = parseFloat(balance.units?.toString() || "0");
		const nanosAmount = (balance.nanos || 0) / 1e9;
		const totalAmount = unitsAmount + nanosAmount;

		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: balance.currencyCode || account.mainCurrency || "USD",
		}).format(totalAmount);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<AlertCircle className="h-5 w-5 text-destructive" />
						delete account
					</DialogTitle>
				</DialogHeader>
				<VStack spacing="md" className="py-4">
					<Muted size="sm">
						Are you sure you want to delete this account? This action cannot be
						undone.
					</Muted>
					<Card variant="subtle" padding="md">
						<VStack spacing="xs">
							<HStack spacing="md" justify="between">
								<Text size="sm" weight="medium">
									account name:
								</Text>
								<Mono size="sm">{account.name}</Mono>
							</HStack>
							{account.friendlyName && (
								<HStack spacing="md" justify="between">
									<Text size="sm" weight="medium">
										friendly name:
									</Text>
									<Mono size="sm">{account.friendlyName}</Mono>
								</HStack>
							)}
							<HStack spacing="md" justify="between">
								<Text size="sm" weight="medium">
									bank:
								</Text>
								<Text size="sm">{account.bank}</Text>
							</HStack>
							<HStack spacing="md" justify="between">
								<Text size="sm" weight="medium">
									type:
								</Text>
								<Text size="sm">{getAccountTypeName(account.type)}</Text>
							</HStack>
							<HStack spacing="md" justify="between">
								<Text size="sm" weight="medium">
									current balance:
								</Text>
								<Mono size="sm">{formatBalance(account.balance)}</Mono>
							</HStack>
						</VStack>
					</Card>
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
					<Button
						type="button"
						variant="destructive"
						onClick={handleConfirm}
						disabled={isLoading}
					>
						{isLoading ? "deleting..." : "delete account"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
