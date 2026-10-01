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
import type { Statement } from "@/gen/nagomi/v1/statement_pb";
import { useUserId } from "@/hooks/useSession";
import { useDeleteStatement, useStatements } from "@/hooks/useStatements";
import { statementsApi } from "@/lib/api/statements";
import { periodLabel as period } from "@/lib/utils/statement";

const periodLabel = (s: Statement) =>
	period(s.periodStart, s.periodEnd) ?? s.fileName;

export function AccountStatements({ accountId }: { accountId: bigint }) {
	const userId = useUserId();
	const { data: statements, isLoading } = useStatements(accountId);
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

	const imported = statements?.filter((s) => s.accountId === accountId) ?? [];

	return (
		<div className="mt-4">
			<div className="border-b pb-2 text-sm text-muted-foreground">
				statements
			</div>

			{isLoading ? (
				<div className="space-y-2 py-2">
					<Skeleton className="h-4 w-48" />
					<Skeleton className="h-4 w-40" />
				</div>
			) : imported.length === 0 ? (
				<p className="py-2 text-sm text-muted-foreground">
					No statements imported for this account.
				</p>
			) : (
				<ul>
					{imported.map((s) => (
						<li
							key={s.id.toString()}
							className="flex items-center gap-3 border-b py-2.5 last:border-b-0"
						>
							<div className="min-w-0 flex-1">
								<span>{periodLabel(s)}</span>
								<span className="ml-2 text-sm text-muted-foreground tabular-nums">
									{s.lineCount}{" "}
									{s.lineCount === 1 ? "transaction" : "transactions"}
								</span>
							</div>
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
								onClick={() => setConfirming(s)}
							>
								Delete
							</Button>
						</li>
					))}
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
		</div>
	);
}
