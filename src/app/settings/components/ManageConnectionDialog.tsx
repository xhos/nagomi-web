"use client";

import { formatDistanceToNow } from "date-fns";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormError, NativeSelect } from "@/components/ui/forms";
import type { Connection } from "@/gen/nagomi/v1/connection_services_pb";
import {
	useDeleteConnection,
	useSetSyncInterval,
	useTriggerSync,
} from "@/hooks/useConnections";
import {
	INTERVAL_OPTIONS,
	intervalToValue,
	type Provider,
	parseIntervalValue,
} from "../providers";

function timestampToDate(ts?: { seconds?: bigint; nanos?: number }) {
	if (!ts?.seconds) return null;
	return new Date(
		Number(ts.seconds) * 1000 + Math.floor((ts.nanos ?? 0) / 1e6),
	);
}

interface ManageConnectionDialogProps {
	provider: Provider;
	connection: Connection | null;
	onOpenChange: (open: boolean) => void;
}

export function ManageConnectionDialog({
	provider,
	connection,
	onOpenChange,
}: ManageConnectionDialogProps) {
	const open = !!connection;
	const [confirmOpen, setConfirmOpen] = useState(false);

	const { triggerSyncAsync, isPending: isSyncing } = useTriggerSync();
	const { setSyncIntervalAsync, isPending: isSavingInterval } =
		useSetSyncInterval();
	const {
		deleteConnectionAsync,
		isPending: isDeleting,
		error: deleteError,
	} = useDeleteConnection();

	if (!connection) return null;

	const lastSyncedDate = timestampToDate(connection.lastSynced);
	const nextRunDate = timestampToDate(connection.nextRunAt);
	const createdDate = timestampToDate(connection.createdAt);
	const errorMessage =
		deleteError instanceof Error ? deleteError.message : null;

	const syncedLabel = lastSyncedDate
		? `Synced ${formatDistanceToNow(lastSyncedDate, { addSuffix: true })}`
		: createdDate
			? `Connected ${formatDistanceToNow(createdDate, { addSuffix: true })}`
			: "Never synced";

	const nextRunLabel =
		nextRunDate && nextRunDate > new Date()
			? `Next run ${formatDistanceToNow(nextRunDate, { addSuffix: true })}`
			: null;

	const onIntervalChange = async (value: string) => {
		await setSyncIntervalAsync({
			id: connection.id,
			syncIntervalMinutes: parseIntervalValue(value),
		});
	};

	const onDisconnect = async () => {
		await deleteConnectionAsync(connection.id);
		setConfirmOpen(false);
		onOpenChange(false);
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{provider.label}
							{connection.status !== "active" && (
								<span className="ml-2 text-sm font-normal text-destructive">
									{connection.status}
								</span>
							)}
						</DialogTitle>
						<DialogDescription>
							{syncedLabel}
							{nextRunLabel && ` · ${nextRunLabel}`}
						</DialogDescription>
					</DialogHeader>

					<Field label="Sync every" htmlFor="sync-interval">
						<NativeSelect
							id="sync-interval"
							value={intervalToValue(connection.syncIntervalMinutes)}
							onChange={(e) => onIntervalChange(e.target.value)}
							disabled={isSavingInterval}
						>
							{INTERVAL_OPTIONS.map((o) => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</NativeSelect>
					</Field>

					<FormError>{errorMessage}</FormError>

					<DialogFooter className="sm:justify-between">
						<Button
							type="button"
							variant="ghost"
							className="text-destructive hover:text-destructive"
							onClick={() => setConfirmOpen(true)}
							disabled={isDeleting}
						>
							Disconnect
						</Button>
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
							>
								Close
							</Button>
							<Button
								type="button"
								onClick={() => triggerSyncAsync(connection.id)}
								disabled={isSyncing}
							>
								{isSyncing ? "Syncing…" : "Sync now"}
							</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Disconnect {provider.label}?</AlertDialogTitle>
						<AlertDialogDescription>
							Syncing stops and the stored credentials are removed. Existing
							transactions are kept.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={onDisconnect} disabled={isDeleting}>
							{isDeleting ? "Disconnecting…" : "Disconnect"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
