"use client";

import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import {
	ErrorMessage,
	FormField,
	HStack,
	Muted,
	VStack,
} from "@/components/lib";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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

const STATUS_VARIANT: Record<
	string,
	"default" | "secondary" | "destructive" | "outline"
> = {
	active: "default",
	disabled: "secondary",
	broken: "destructive",
};

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
		? `synced ${formatDistanceToNow(lastSyncedDate, { addSuffix: true })}`
		: createdDate
			? `connected ${formatDistanceToNow(createdDate, { addSuffix: true })}`
			: "never synced";

	const nextRunLabel =
		nextRunDate && nextRunDate > new Date()
			? `next run ${formatDistanceToNow(nextRunDate, { addSuffix: true })}`
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
						<DialogTitle className="flex items-center gap-2">
							{provider.label}
							<Badge variant={STATUS_VARIANT[connection.status] ?? "outline"}>
								{connection.status}
							</Badge>
						</DialogTitle>
					</DialogHeader>

					<VStack spacing="md" className="py-2">
						<VStack spacing="xs">
							<Muted size="xs">{syncedLabel}</Muted>
							{nextRunLabel && <Muted size="xs">{nextRunLabel}</Muted>}
						</VStack>

						<FormField label="sync frequency">
							<Select
								value={intervalToValue(connection.syncIntervalMinutes)}
								onValueChange={onIntervalChange}
								disabled={isSavingInterval}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{INTERVAL_OPTIONS.map((o) => (
										<SelectItem key={o.value} value={o.value}>
											{o.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FormField>

						{errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}
					</VStack>

					<DialogFooter className="sm:justify-between">
						<Button
							type="button"
							variant="outline"
							onClick={() => setConfirmOpen(true)}
							disabled={isDeleting}
						>
							disconnect
						</Button>
						<HStack spacing="sm">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
							>
								close
							</Button>
							<Button
								type="button"
								onClick={() => triggerSyncAsync(connection.id)}
								disabled={isSyncing}
							>
								{isSyncing ? "syncing..." : "sync now"}
							</Button>
						</HStack>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>disconnect {provider.label}?</AlertDialogTitle>
						<AlertDialogDescription>
							sync will stop and the stored credentials will be removed.
							existing transactions are kept.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>cancel</AlertDialogCancel>
						<AlertDialogAction onClick={onDisconnect} disabled={isDeleting}>
							{isDeleting ? "disconnecting..." : "disconnect"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
