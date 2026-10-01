"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { FormError } from "@/components/ui/forms";
import { Skeleton } from "@/components/ui/skeleton";
import type { Statement } from "@/gen/nagomi/v1/statement_pb";
import { useUserId } from "@/hooks/useSession";
import { useInvalidateStatementData } from "@/hooks/useStatements";
import { statementErrorMessage, statementsApi } from "@/lib/api/statements";
import { periodLabel } from "@/lib/utils/statement";
import { ReconciliationSummary } from "./ReconciliationSummary";

// what the balance check says after a re-parse, when it says something new
function balanceNote(before: Statement, after: Statement) {
	if (after.balanceOk === undefined) return null;
	if (after.balanceOk)
		return before.balanceOk === false
			? "Its lines now add up to the statement's balances."
			: null;
	return "Its lines still don't add up to the statement's balances.";
}

// runs a stored statement through the parser again: a dry run first, then apply
export function ReparseStatementDialog({
	statement,
	onOpenChange,
}: {
	statement: Statement | null;
	onOpenChange: (open: boolean) => void;
}) {
	const userId = useUserId();
	const invalidate = useInvalidateStatementData();
	const [applying, setApplying] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const preview = useQuery({
		queryKey: ["reparse-preview", userId, statement?.id.toString()],
		queryFn: () => {
			if (!userId || !statement) throw new Error("nothing to re-parse");
			return statementsApi.reparse(userId, statement.id, false);
		},
		enabled: !!userId && !!statement,
		// a dry run against the account as it stands now
		gcTime: 0,
		staleTime: 0,
		retry: false,
	});

	const close = () => {
		if (applying) return;
		setError(null);
		onOpenChange(false);
	};

	const apply = async () => {
		if (!userId || !statement) return;
		setApplying(true);
		setError(null);
		try {
			await statementsApi.reparse(userId, statement.id, true);
			invalidate();
			onOpenChange(false);
		} catch (e) {
			setError(statementErrorMessage(e, "Couldn't re-parse this statement."));
		} finally {
			setApplying(false);
		}
	};

	const after = preview.data?.statement;
	const note = statement && after ? balanceNote(statement, after) : null;

	return (
		<Dialog open={!!statement} onOpenChange={close}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>re-parse statement</DialogTitle>
				</DialogHeader>

				{statement && (
					<div className="space-y-3">
						<div>
							<div>
								{periodLabel(statement.periodStart, statement.periodEnd) ??
									statement.fileName}
							</div>
							<div className="text-sm text-muted-foreground">
								Reads the stored file again with the current parser and
								reconciles the account with what it finds.
							</div>
						</div>

						{preview.isLoading ? (
							<div className="space-y-2">
								<Skeleton className="h-4 w-64" />
								<Skeleton className="h-4 w-40" />
							</div>
						) : preview.error ? (
							<p className="text-sm text-destructive">
								{statementErrorMessage(
									preview.error,
									"Couldn't read this statement again.",
								)}
							</p>
						) : (
							preview.data?.reconciliation && (
								<>
									{note && <p className="text-sm">{note}</p>}
									<ReconciliationSummary
										reconciliation={preview.data.reconciliation}
										lines={preview.data.lines}
										currency={statement.currency}
										alreadyLabel="unchanged"
									/>
								</>
							)
						)}

						<FormError>{error}</FormError>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={close} disabled={applying}>
						Cancel
					</Button>
					<Button
						onClick={apply}
						disabled={applying || !preview.data || !!preview.error}
					>
						{applying ? "Applying…" : "Apply"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
