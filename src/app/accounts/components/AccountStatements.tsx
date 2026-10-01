"use client";

import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type Statement,
	type StatementCoveragePeriod,
	StatementCoverageStatus,
} from "@/gen/nagomi/v1/statement_pb";
import { useAccounts } from "@/hooks/useAccounts";
import { useUserId } from "@/hooks/useSession";
import {
	useDeleteStatement,
	useStatementCoverage,
	useStatements,
} from "@/hooks/useStatements";
import { statementsApi } from "@/lib/api/statements";
import { periodLabel as period } from "@/lib/utils/statement";

import { ImportStatementsDialog } from "./ImportStatementsDialog";
import { ReparseStatementDialog } from "./ReparseStatementDialog";

const periodLabel = (s: Statement) =>
	period(s.periodStart, s.periodEnd) ?? s.fileName;

const S = StatementCoverageStatus;

// "1 missing, 1 due, 1 doesn't add up"
function coverageNote(periods: StatementCoveragePeriod[]) {
	const count = (status: StatementCoverageStatus) =>
		periods.filter((p) => p.status === status).length;
	return [
		[count(S.MISSING), "missing"],
		[count(S.DUE), "due"],
		[count(S.UNBALANCED), "doesn't add up"],
	]
		.filter(([n]) => (n as number) > 0)
		.map(([n, label]) => `${n} ${label}`)
		.join(", ");
}

export function AccountStatements({ accountId }: { accountId: bigint }) {
	const userId = useUserId();
	const { data: statements, isLoading: loadingStatements } =
		useStatements(accountId);
	const { data: coverage, isLoading: loadingCoverage } =
		useStatementCoverage(accountId);
	const { accounts } = useAccounts();
	const [uploading, setUploading] = useState(false);
	const [reparsing, setReparsing] = useState<Statement | null>(null);
	const { mutateAsync: deleteStatement, isPending: deleting } =
		useDeleteStatement();
	const [confirming, setConfirming] = useState<Statement | null>(null);
	const [error, setError] = useState<string | null>(null);

	const view = async (s: Statement) => {
		if (!userId) return;
		setError(null);
		// open synchronously, or popup blockers eat the window after the await
		const tab = window.open("", "_blank");
		try {
			const r = await statementsApi.get(userId, s.id);
			const url = URL.createObjectURL(
				new Blob([r.pdfData as BlobPart], { type: "application/pdf" }),
			);
			if (tab) tab.location.href = url;
			else window.location.href = url;
		} catch {
			tab?.close();
			setError("Couldn't open this statement.");
		}
	};

	const remove = async (deleteTransactions: boolean) => {
		if (!confirming) return;
		try {
			await deleteStatement({ id: confirming.id, deleteTransactions });
			setError(null);
		} catch {
			setError("Couldn't delete this statement.");
		} finally {
			setConfirming(null);
		}
	};

	const byId = new Map(statements?.map((x) => [x.id, x]));
	// newest first, like the statements list it replaces
	const periods = [...(coverage ?? [])].reverse();
	const note = coverageNote(periods);
	const isLoading = loadingStatements || loadingCoverage;

	return (
		<div className="mt-4">
			<div className="flex items-baseline justify-between gap-3 border-b pb-2 text-sm text-muted-foreground">
				<span>statements</span>
				{note && <span>{note}</span>}
			</div>

			{isLoading ? (
				<div className="space-y-2 py-2">
					<Skeleton className="h-4 w-48" />
					<Skeleton className="h-4 w-40" />
				</div>
			) : periods.length === 0 ? (
				<p className="py-2 text-sm text-muted-foreground">
					No statements imported for this account.
				</p>
			) : (
				<ul>
					{periods.map((p) => {
						const s =
							p.statementId !== undefined ? byId.get(p.statementId) : undefined;
						const label = period(p.start, p.end);
						const meta =
							p.status === S.MISSING
								? "Missing"
								: p.status === S.DUE
									? "Due"
									: [
											s &&
												`${s.lineCount} ${s.lineCount === 1 ? "transaction" : "transactions"}`,
											p.status === S.UNBALANCED && "Doesn't add up",
										]
											.filter(Boolean)
											.join(" · ");
						return (
							<li
								key={`${label}-${p.statementId ?? ""}`}
								className="flex items-center gap-3 border-b py-2.5 last:border-b-0"
							>
								<div className="min-w-0 flex-1">
									<span>{label}</span>
									<span className="ml-2 text-sm text-muted-foreground tabular-nums">
										{meta}
									</span>
								</div>
								{s ? (
									<>
										<Button
											variant="link"
											size="sm"
											className="h-auto p-0 text-muted-foreground hover:text-foreground"
											onClick={() => view(s)}
										>
											View
										</Button>
										<Button
											variant="link"
											size="sm"
											className="h-auto p-0 text-muted-foreground hover:text-foreground"
											onClick={() => setReparsing(s)}
										>
											Re-parse
										</Button>
										<Button
											variant="link"
											size="sm"
											className="h-auto p-0 text-muted-foreground hover:text-foreground"
											onClick={() => setConfirming(s)}
										>
											Delete
										</Button>
									</>
								) : (
									<Button
										variant="link"
										size="sm"
										className="h-auto p-0 text-muted-foreground hover:text-foreground"
										onClick={() => setUploading(true)}
									>
										Upload
									</Button>
								)}
							</li>
						);
					})}
				</ul>
			)}

			{error && <p className="mt-2 text-sm text-destructive">{error}</p>}

			<AlertDialog
				open={!!confirming}
				onOpenChange={(o) => !o && setConfirming(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete the {confirming && periodLabel(confirming)} statement?
						</AlertDialogTitle>
						<AlertDialogDescription>
							The file is removed. Its transactions stay unless you delete them
							too. This can't be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
						<Button
							variant="outline"
							onClick={() => remove(false)}
							disabled={deleting}
						>
							Delete statement only
						</Button>
						<AlertDialogAction onClick={() => remove(true)} disabled={deleting}>
							{deleting ? "Deleting…" : "Delete with transactions"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<ReparseStatementDialog
				statement={reparsing}
				onOpenChange={(open) => !open && setReparsing(null)}
			/>

			<ImportStatementsDialog
				open={uploading}
				onOpenChange={setUploading}
				accounts={accounts}
			/>
		</div>
	);
}
