"use client";

import { format } from "date-fns";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import type { ParsedStatementLine } from "@/gen/nagomi/v1/statement_parser_pb";
import {
	ReconciliationAction,
	ReconciliationKeepReason,
	type StatementReconciliation,
} from "@/gen/nagomi/v1/statement_services_pb";
import { fromProtoDate } from "@/lib/utils/date";
import { formatAmount, formatCurrency } from "@/lib/utils/transaction";

const A = ReconciliationAction;

const KEPT_BECAUSE: Record<ReconciliationKeepReason, string> = {
	[ReconciliationKeepReason.UNSPECIFIED]: "Kept",
	[ReconciliationKeepReason.MANUAL]: "Kept, entered by hand",
	[ReconciliationKeepReason.USER_DATA]: "Kept, has notes, a receipt or splits",
	[ReconciliationKeepReason.GRACE]: "Kept, may be on the next statement",
};

const tone = (d?: TransactionDirection) =>
	d === TransactionDirection.DIRECTION_INCOMING ? "in" : "out";

// what importing a statement into an account does: a one-line count, and the changes
// other than plain confirmations on request
export function ReconciliationSummary({
	reconciliation,
	lines,
	currency,
}: {
	reconciliation: StatementReconciliation;
	lines: ParsedStatementLine[];
	currency: string;
}) {
	const [open, setOpen] = useState(false);
	const items = reconciliation.items;
	const count = (a: ReconciliationAction) =>
		items.filter((i) => i.action === a).length;

	const parts = [
		[count(A.CONFIRM), "confirmed"],
		[count(A.UPDATE_AMOUNT), "with a new amount"],
		[count(A.CREATE), "new"],
		[count(A.DELETE), "to delete"],
		[count(A.KEEP), "kept"],
		[count(A.ALREADY_IMPORTED), "already imported"],
	] as const;
	const sentence = parts
		.filter(([n]) => n > 0)
		.map(([n, label]) => `${n} ${label}`)
		.join(", ");

	const changes = items.filter(
		(i) => i.action !== A.CONFIRM && i.action !== A.ALREADY_IMPORTED,
	);

	return (
		<div className="text-sm">
			<p className="text-muted-foreground">
				{sentence ? `${sentence}.` : "Nothing to change."}
				{changes.length > 0 && (
					<button
						type="button"
						onClick={() => setOpen((o) => !o)}
						className="ml-2 hover:text-foreground hover:underline"
					>
						{open ? "Hide changes" : "Show changes"}
					</button>
				)}
			</p>
			{open && (
				<ul className="mt-1">
					{changes.map((item, i) => {
						const line =
							item.lineIndex !== undefined ? lines[item.lineIndex] : undefined;
						const tx = item.transaction;
						const day = line
							? fromProtoDate(line.date)
							: tx?.txDate
								? new Date(Number(tx.txDate.seconds) * 1000)
								: null;
						const meta =
							item.action === A.CREATE
								? "New"
								: item.action === A.UPDATE_AMOUNT
									? `Amount was ${formatCurrency(formatAmount(tx?.txAmount), currency)}`
									: item.action === A.DELETE
										? "Deleted, not on the statement"
										: KEPT_BECAUSE[item.keepReason];
						return (
							<li
								// items have no id of their own; their order is stable
								key={i}
								className="flex items-start justify-between gap-3 py-1"
							>
								<div className="min-w-0">
									<div className="truncate">
										{line?.description || tx?.description || "—"}
									</div>
									<div className="text-muted-foreground">
										{[day && format(day, "MMM d"), meta]
											.filter(Boolean)
											.join(" · ")}
									</div>
								</div>
								<Amount
									value={
										line
											? Number(line.amountCents) / 100
											: formatAmount(tx?.txAmount)
									}
									currency={currency}
									tone={tone(line?.direction ?? tx?.direction)}
									className="shrink-0"
								/>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
