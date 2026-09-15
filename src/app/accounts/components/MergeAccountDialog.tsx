"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormError, NativeSelect } from "@/components/ui/forms";
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
	const [targetId, setTargetId] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [moved, setMoved] = useState<bigint | null>(null);
	const targets = allAccounts.filter((a) => a.id !== account?.id);
	const target = targets.find((a) => a.id.toString() === targetId);

	const close = (o: boolean) => {
		if (!o) {
			setTargetId("");
			setMoved(null);
			setError(null);
		}
		onOpenChange(o);
	};

	const confirm = async () => {
		if (!targetId) return;
		setBusy(true);
		setError(null);
		try {
			const r = await onConfirm(BigInt(targetId));
			setMoved(r.transactionsMoved);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Couldn't merge accounts");
		} finally {
			setBusy(false);
		}
	};

	if (!account) return null;
	const name = account.friendlyName || account.name;

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="sm:max-w-[460px]">
				<DialogHeader>
					<DialogTitle>merge {name}</DialogTitle>
					<DialogDescription>
						{moved === null
							? `${name} will be deleted and its transactions moved to the account you pick.`
							: `${moved.toString()} transaction${moved === BigInt(1) ? "" : "s"} moved to ${target?.friendlyName || target?.name}.`}
					</DialogDescription>
				</DialogHeader>
				{moved === null && (
					<Field label="Merge into" htmlFor="merge-target">
						<NativeSelect
							id="merge-target"
							value={targetId}
							onChange={(e) => setTargetId(e.target.value)}
						>
							<option value="">Choose an account</option>
							{targets.map((a) => (
								<option key={a.id.toString()} value={a.id.toString()}>
									{a.friendlyName || a.name} · {a.bank}
								</option>
							))}
						</NativeSelect>
					</Field>
				)}
				<FormError>{error}</FormError>
				<DialogFooter>
					{moved === null ? (
						<>
							<Button
								variant="outline"
								onClick={() => close(false)}
								disabled={busy}
							>
								Cancel
							</Button>
							<Button onClick={confirm} disabled={busy || !targetId}>
								{busy ? "Merging…" : "Merge"}
							</Button>
						</>
					) : (
						<Button onClick={() => close(false)}>Done</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
