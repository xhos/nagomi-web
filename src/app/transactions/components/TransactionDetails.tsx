"use client";

import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { DetailRow as Row } from "@/components/ui/list";
import { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useForgiveTransaction } from "@/hooks/useSplits";
import { formatAmount } from "@/lib/utils/transaction";

interface TransactionDetailsProps {
	transaction: Transaction;
	getAccountDisplayName: (accountId: bigint, accountName?: string) => string;
	onEdit?: () => void;
	onSplit?: () => void;
	onCreateRule?: () => void;
	onViewReceipt?: () => void;
	onDelete?: () => void;
}

const stamp = (t?: { seconds?: bigint }) =>
	t?.seconds
		? new Date(Number(t.seconds) * 1000).toLocaleString("en-US", {
				dateStyle: "medium",
				timeStyle: "short",
			})
		: undefined;

export function TransactionDetails({
	transaction: tx,
	getAccountDisplayName,
	onEdit,
	onSplit,
	onCreateRule,
	onViewReceipt,
	onDelete,
}: TransactionDetailsProps) {
	const { mutate: forgive, isPending: forgiving } = useForgiveTransaction();
	const [forgiveError, setForgiveError] = useState<string | null>(null);
	const tone =
		tx.direction === TransactionDirection.DIRECTION_INCOMING ? "in" : "out";

	return (
		<div className="mt-3 border-t pt-3 text-sm">
			<div className="grid gap-x-8 sm:grid-cols-2">
				<div>
					<Row label="Description">{tx.description || "—"}</Row>
					<Row label="Merchant">
						{tx.merchant || "—"}
						{tx.merchant && (
							<span className="ml-2 text-muted-foreground">
								{tx.merchantManuallySet ? "set by you" : "detected"}
							</span>
						)}
					</Row>
					<Row label="Category">
						{tx.category ? tx.category.slug.split(".").join(" / ") : "—"}
						{tx.category && (
							<span className="ml-2 text-muted-foreground">
								{tx.categoryManuallySet ? "set by you" : "by rule"}
							</span>
						)}
					</Row>
					<Row label="Account">
						{getAccountDisplayName(tx.accountId, tx.accountName)}
					</Row>
					<Row label="Date">{stamp(tx.txDate) ?? "—"}</Row>
					{tx.userNotes && <Row label="Notes">{tx.userNotes}</Row>}
				</div>
				<div>
					<Row label="Amount">
						<Amount
							value={formatAmount(tx.txAmount)}
							currency={tx.txAmount?.currencyCode}
							tone={tone}
						/>
					</Row>
					{tx.foreignAmount && (
						<Row label="Original">
							<Amount
								value={formatAmount(tx.foreignAmount)}
								currency={tx.foreignAmount.currencyCode}
								tone={tone}
							/>
							{tx.exchangeRate && (
								<span className="ml-2 text-muted-foreground">
									at {tx.exchangeRate}
								</span>
							)}
						</Row>
					)}
					{tx.balanceAfter && (
						<Row label="Balance after">
							<Amount
								value={formatAmount(tx.balanceAfter)}
								currency={tx.balanceAfter.currencyCode}
							/>
						</Row>
					)}
					{tx.receiptId && (
						<Row label="Receipt">
							<button
								type="button"
								onClick={onViewReceipt}
								className="underline underline-offset-2 hover:text-foreground"
							>
								View receipt
							</button>
						</Row>
					)}
					{tx.splitFromId && (
						<Row label="Split">
							{tx.forgiven ? "Forgiven" : "Outstanding"}
							<Button
								variant="link"
								size="sm"
								className="ml-2 h-auto p-0"
								disabled={forgiving}
								onClick={() => {
									setForgiveError(null);
									forgive(
										{ transactionId: tx.id, forgiven: !tx.forgiven },
										{
											onError: (e) =>
												setForgiveError(
													e instanceof Error ? e.message : "Failed",
												),
										},
									);
								}}
							>
								{tx.forgiven ? "Mark outstanding" : "Forgive"}
							</Button>
							{forgiveError && (
								<span className="ml-2 text-destructive">{forgiveError}</span>
							)}
						</Row>
					)}
					{tx.splits.length > 0 && (
						<Row label="Splits">
							{tx.splits.map((s) => (
								<span
									key={s.id.toString()}
									className="flex justify-between gap-4"
								>
									<span>
										{getAccountDisplayName(s.accountId, s.accountName)}
										{s.forgiven && (
											<span className="ml-2 text-muted-foreground">
												forgiven
											</span>
										)}
									</span>
									<Amount
										value={formatAmount(s.txAmount)}
										currency={s.txAmount?.currencyCode}
										tone="out"
									/>
								</span>
							))}
						</Row>
					)}
					<Row label="Updated">
						{stamp(tx.updatedAt) ?? stamp(tx.createdAt) ?? "—"}
					</Row>
				</div>
			</div>

			<div className="mt-3 flex flex-wrap gap-2">
				{onEdit && (
					<Button variant="outline" size="sm" onClick={onEdit}>
						Edit
					</Button>
				)}
				{onSplit && (
					<Button variant="outline" size="sm" onClick={onSplit}>
						{tx.splits.length > 0 ? "Re-split" : "Split"}
					</Button>
				)}
				{onCreateRule && (
					<Button variant="outline" size="sm" onClick={onCreateRule}>
						Create rule
					</Button>
				)}
				{onDelete && (
					<Button
						variant="ghost"
						size="sm"
						className="ml-auto text-destructive hover:text-destructive"
						onClick={onDelete}
					>
						Delete
					</Button>
				)}
			</div>
		</div>
	);
}
