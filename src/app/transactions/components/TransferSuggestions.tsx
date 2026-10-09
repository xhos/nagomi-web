"use client";

import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { ListGroup } from "@/components/ui/list";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { useAccounts } from "@/hooks/useAccounts";
import {
	useLinkTransfer,
	useRejectTransfer,
	useTransferSuggestions,
} from "@/hooks/useTransfers";
import { formatAmount } from "@/lib/utils/transaction";

const day = (t: Transaction) =>
	new Date(Number(t.txDate?.seconds ?? 0) * 1000).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});

// pairs that look like a move between own accounts but need the user's word
export function TransferSuggestions() {
	const { data: suggestions = [] } = useTransferSuggestions();
	const { getAccountDisplayName } = useAccounts();
	const link = useLinkTransfer();
	const reject = useRejectTransfer();
	const busy = link.isPending || reject.isPending;
	const error = link.error ?? reject.error;

	if (!suggestions.length) return null;

	return (
		<ListGroup
			title="possible transfers"
			note="Linked transfers don't count as spending or income"
			className="mb-6"
		>
			{suggestions.map(({ outgoing, incoming }) => {
				if (!outgoing || !incoming) return null;
				const key = `${outgoing.id}:${incoming.id}`;
				const sameDay = day(outgoing) === day(incoming);
				return (
					<div key={key} className="flex items-start gap-3 py-2 pl-7">
						<div className="min-w-0 flex-1">
							<div className="truncate font-medium">
								{getAccountDisplayName(outgoing.accountId)} to{" "}
								{getAccountDisplayName(incoming.accountId)}
							</div>
							<div className="mt-0.5 truncate text-sm text-muted-foreground">
								{sameDay
									? day(outgoing)
									: `${day(outgoing)} and ${day(incoming)}`}
								{" · "}
								{outgoing.description || outgoing.merchant}
								{" · "}
								{incoming.description || incoming.merchant}
							</div>
						</div>
						<Amount
							value={formatAmount(outgoing.txAmount)}
							currency={outgoing.txAmount?.currencyCode}
							className="shrink-0 font-medium"
						/>
						<div className="flex shrink-0 gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={busy}
								onClick={() =>
									link.mutate({
										outgoingId: outgoing.id,
										incomingId: incoming.id,
									})
								}
							>
								Link
							</Button>
							<Button
								variant="ghost"
								size="sm"
								disabled={busy}
								onClick={() =>
									reject.mutate({
										transactionId: outgoing.id,
										counterpartId: incoming.id,
									})
								}
							>
								Not a transfer
							</Button>
						</div>
					</div>
				);
			})}
			{error && (
				<p className="py-2 text-sm text-destructive">{error.message}</p>
			)}
		</ListGroup>
	);
}
