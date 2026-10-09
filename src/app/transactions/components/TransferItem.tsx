"use client";

import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { ArrowLeftRight, Ellipsis, FileText } from "lucide-react";
import { memo } from "react";
import { Amount } from "@/components/ui/amount";
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
import { DetailRow, ListRow, RowMenuButton } from "@/components/ui/list";
import type { Money } from "@/gen/google/type/money_pb";
import { TransactionDirection, TransferMethod } from "@/gen/nagomi/v1/enums_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { formatAmount, formatTime } from "@/lib/utils/transaction";
import { RowCheckbox } from "./TransactionItem";

const METHOD: Record<TransferMethod, string> = {
	[TransferMethod.UNSPECIFIED]: "",
	[TransferMethod.REFERENCE]: "Paired by the bank's reference",
	[TransferMethod.MATCHED]: "Matched automatically",
	[TransferMethod.MANUAL]: "Linked by you",
};

const stamp = (t?: Timestamp) =>
	t?.seconds
		? new Date(Number(t.seconds) * 1000).toLocaleString("en-US", {
				dateStyle: "medium",
				timeStyle: "short",
			})
		: "—";

interface Side {
	accountId: bigint;
	amount?: Money;
	date?: Timestamp;
	description?: string;
}

interface TransferItemProps {
	// either side of a linked transfer; the other one is described by its transfer
	transaction: Transaction;
	isSelected: boolean;
	onSelect: (id: bigint, index: number, event: React.MouseEvent) => void;
	globalIndex: number;
	expanded: boolean;
	onToggle: (id: bigint) => void;
	getAccountDisplayName: (accountId: bigint, accountName?: string) => string;
	onUnlink: (transaction: Transaction) => void;
}

// a move between own accounts as one row: neither spending nor income
export const TransferItem = memo(function TransferItem({
	transaction: tx,
	isSelected,
	onSelect,
	globalIndex,
	expanded,
	onToggle,
	getAccountDisplayName,
	onUnlink,
}: TransferItemProps) {
	const transfer = tx.transfer;
	if (!transfer) return null;

	const self: Side = {
		accountId: tx.accountId,
		amount: tx.txAmount,
		date: tx.txDate,
		description: tx.description || tx.merchant,
	};
	const other: Side = {
		accountId: transfer.counterpartAccountId,
		amount: transfer.counterpartAmount,
		date: transfer.counterpartDate,
		description: transfer.counterpartDescription,
	};
	const outgoing = tx.direction === TransactionDirection.DIRECTION_OUTGOING;
	const from = outgoing ? self : other;
	const to = outgoing ? other : self;
	const fromName = getAccountDisplayName(from.accountId);
	const toName = getAccountDisplayName(to.accountId);
	const converted =
		!!to.amount && from.amount?.currencyCode !== to.amount.currencyCode;
	const time = formatTime(tx.txDate);

	const handleRowClick = (event: React.MouseEvent) => {
		if (event.ctrlKey || event.metaKey || event.shiftKey) {
			event.preventDefault();
			onSelect(tx.id, globalIndex, event);
			return;
		}
		onToggle(tx.id);
	};

	const handleCheck = (event: React.MouseEvent) => {
		event.stopPropagation();
		onSelect(
			tx.id,
			globalIndex,
			event.shiftKey ? event : ({ ctrlKey: true } as React.MouseEvent),
		);
	};

	const actions = (
		Item: typeof ContextMenuItem,
		Separator: typeof ContextMenuSeparator,
	) => (
		<>
			<Item onClick={() => onToggle(tx.id)}>
				<FileText /> {expanded ? "Collapse" : "Details"}
			</Item>
			<Separator />
			<Item onClick={() => onUnlink(tx)}>
				<ArrowLeftRight /> Not a transfer
			</Item>
		</>
	);

	const side = (label: string, s: Side) => (
		<DetailRow label={label}>
			{getAccountDisplayName(s.accountId)}
			<span className="ml-2 text-muted-foreground">
				{s.description || "—"} · {stamp(s.date)}
			</span>
		</DetailRow>
	);

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<ListRow
					selected={isSelected}
					expanded={expanded}
					onClick={handleRowClick}
				>
					<div className="flex items-start gap-3">
						<RowCheckbox checked={isSelected} onClick={handleCheck} />

						<div className="min-w-0 flex-1">
							<div className="truncate font-medium">
								{fromName} to {toName}
							</div>
							<div className="mt-0.5 truncate text-sm text-muted-foreground">
								Transfer
								{from.description && ` · ${from.description}`}
							</div>
						</div>

						<div className="shrink-0 text-right">
							<Amount
								value={formatAmount(from.amount)}
								currency={from.amount?.currencyCode}
								className="block font-medium"
							/>
							{converted ? (
								<span className="block text-sm text-muted-foreground">
									<Amount
										value={formatAmount(to.amount)}
										currency={to.amount?.currencyCode}
									/>
								</span>
							) : transfer.fee ? (
								<span className="block text-sm text-muted-foreground">
									<Amount
										value={formatAmount(transfer.fee)}
										currency={transfer.fee.currencyCode}
									/>{" "}
									fee
								</span>
							) : (
								time && (
									<span className="block text-sm text-muted-foreground">
										{time}
									</span>
								)
							)}
						</div>

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
								{actions(DropdownMenuItem, DropdownMenuSeparator)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					{expanded && (
						<div className="pl-7" onClick={(e) => e.stopPropagation()}>
							<div className="mt-3 border-t pt-3 text-sm">
								{side("From", from)}
								{side("To", to)}
								<DetailRow label="Amount">
									<Amount
										value={formatAmount(from.amount)}
										currency={from.amount?.currencyCode}
									/>
									{to.amount && (converted || transfer.fee) && (
										<span className="ml-2 text-muted-foreground">
											<Amount
												value={formatAmount(to.amount)}
												currency={to.amount.currencyCode}
											/>{" "}
											arrived
										</span>
									)}
								</DetailRow>
								{transfer.fee && (
									<DetailRow label="Fee">
										<Amount
											value={formatAmount(transfer.fee)}
											currency={transfer.fee.currencyCode}
										/>
										<span className="ml-2 text-muted-foreground">
											counted as spending
										</span>
									</DetailRow>
								)}
								<DetailRow label="Paired">{METHOD[transfer.method]}</DetailRow>
								<div className="mt-3 flex flex-wrap gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => onUnlink(tx)}
									>
										Not a transfer
									</Button>
								</div>
							</div>
						</div>
					)}
				</ListRow>
			</ContextMenuTrigger>
			<ContextMenuContent>
				{actions(ContextMenuItem, ContextMenuSeparator)}
			</ContextMenuContent>
		</ContextMenu>
	);
});
