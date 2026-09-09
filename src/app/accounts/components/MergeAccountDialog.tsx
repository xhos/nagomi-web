"use client";

import { Merge } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Account } from "@/gen/nagomi/v1/account_pb";

interface MergeAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account: Account | null;
	allAccounts: Account[];
	onConfirm: (
		primaryAccountId: bigint,
	) => Promise<{ transactionsMoved: bigint }>;
}

export function MergeAccountDialog({
	open,
	onOpenChange,
	account,
	allAccounts,
	onConfirm,
}: MergeAccountDialogProps) {
	const [selectedPrimaryId, setSelectedPrimaryId] = useState<string>("");
	const [isLoading, setIsLoading] = useState(false);
	const [transactionsMoved, setTransactionsMoved] = useState<bigint | null>(
		null,
	);

	const mergeableAccounts = allAccounts.filter((a) => a.id !== account?.id);

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setSelectedPrimaryId("");
			setTransactionsMoved(null);
		}
		onOpenChange(open);
	};

	const handleConfirm = async () => {
		if (!selectedPrimaryId) return;
		setIsLoading(true);
		try {
			const result = await onConfirm(BigInt(selectedPrimaryId));
			setTransactionsMoved(result.transactionsMoved);
		} catch (error) {
			console.error("Failed to merge accounts:", error);
		} finally {
			setIsLoading(false);
		}
	};

	if (!account) return null;

	const selectedPrimary = mergeableAccounts.find(
		(a) => a.id.toString() === selectedPrimaryId,
	);

	if (transactionsMoved !== null) {
		return (
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Merge className="h-5 w-5" />
							merge complete
						</DialogTitle>
					</DialogHeader>
					<VStack spacing="md" className="py-4">
						<Muted size="sm">The account has been merged successfully.</Muted>
						<Card variant="subtle" padding="md">
							<VStack spacing="xs">
								<HStack spacing="md" justify="between">
									<Text size="sm" weight="medium">
										transactions moved:
									</Text>
									<Mono size="sm">{transactionsMoved.toString()}</Mono>
								</HStack>
								{selectedPrimary && (
									<HStack spacing="md" justify="between">
										<Text size="sm" weight="medium">
											surviving account:
										</Text>
										<Mono size="sm">
											{selectedPrimary.friendlyName || selectedPrimary.name}
										</Mono>
									</HStack>
								)}
							</VStack>
						</Card>
					</VStack>
					<DialogFooter>
						<Button type="button" onClick={() => handleOpenChange(false)}>
							done
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Merge className="h-5 w-5" />
						merge account
					</DialogTitle>
				</DialogHeader>
				<VStack spacing="md" className="py-4">
					<Muted size="sm">
						This account will be deleted and its transactions moved to the
						selected account.
					</Muted>
					<Card variant="subtle" padding="md">
						<VStack spacing="xs">
							<HStack spacing="md" justify="between">
								<Text size="sm" weight="medium">
									merging from:
								</Text>
								<Mono size="sm">{account.friendlyName || account.name}</Mono>
							</HStack>
							<HStack spacing="md" justify="between">
								<Text size="sm" weight="medium">
									bank:
								</Text>
								<Text size="sm">{account.bank}</Text>
							</HStack>
						</VStack>
					</Card>
					<VStack spacing="xs">
						<Label>merge into</Label>
						<Select
							value={selectedPrimaryId}
							onValueChange={setSelectedPrimaryId}
						>
							<SelectTrigger>
								<SelectValue placeholder="select target account" />
							</SelectTrigger>
							<SelectContent>
								{mergeableAccounts.map((a) => (
									<SelectItem key={a.id.toString()} value={a.id.toString()}>
										{a.friendlyName ? `${a.name} (${a.friendlyName})` : a.name}{" "}
										— {a.bank}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</VStack>
				</VStack>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => handleOpenChange(false)}
						disabled={isLoading}
					>
						cancel
					</Button>
					<Button
						type="button"
						onClick={handleConfirm}
						disabled={isLoading || !selectedPrimaryId}
					>
						{isLoading ? "merging..." : "merge"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
