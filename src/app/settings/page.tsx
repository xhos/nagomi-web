"use client";

import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/forms";
import {
	PageContainer,
	PageContent,
	PageHeaderWithTitle,
} from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import type { Connection } from "@/gen/nagomi/v1/connection_services_pb";
import { useConnections } from "@/hooks/useConnections";
import { useSession, useUserId } from "@/hooks/useSession";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { ConnectProviderDialog } from "./components/ConnectProviderDialog";
import { ManageConnectionDialog } from "./components/ManageConnectionDialog";
import { intervalLabel, PROVIDERS, type Provider } from "./providers";

function timestampToDate(ts?: { seconds?: bigint; nanos?: number }) {
	if (!ts?.seconds) return null;
	return new Date(
		Number(ts.seconds) * 1000 + Math.floor((ts.nanos ?? 0) / 1e6),
	);
}

export default function SettingsPage() {
	const userId = useUserId();
	const { connections, isLoading, error } = useConnections();

	const [connectProvider, setConnectProvider] = useState<Provider | null>(null);
	const [manageConnection, setManageConnection] = useState<Connection | null>(
		null,
	);

	const connectionsByProvider = useMemo(() => {
		const map = new Map<string, Connection>();
		for (const c of connections) map.set(c.provider, c);
		return map;
	}, [connections]);

	const manageProvider = manageConnection
		? (PROVIDERS.find((p) => p.slug === manageConnection.provider) ?? {
				slug: manageConnection.provider,
				label: manageConnection.provider,
				description: "",
				fields: [],
			})
		: null;

	return (
		<PageContainer>
			<PageContent>
				<PageHeaderWithTitle title="settings" />
				{error && (
					<p className="mb-4 text-sm text-destructive">
						Couldn't load connections: {String(error)}
					</p>
				)}

				<div className="divide-y">
					<Section title="profile" description="Signed-in account and session.">
						<ProfileSection />
					</Section>

					<Section title="appearance" description="Theme used on this device.">
						<AppearanceSection />
					</Section>

					<Section
						title="connections"
						description="Pull transactions from outside services on a schedule."
					>
						{!userId || isLoading ? (
							<div className="space-y-3">
								<Skeleton className="h-4 w-48" />
								<Skeleton className="h-4 w-40" />
							</div>
						) : (
							<div className="divide-y border-y">
								{PROVIDERS.map((provider) => (
									<ProviderRow
										key={provider.slug}
										provider={provider}
										connection={
											connectionsByProvider.get(provider.slug) ?? null
										}
										onConnect={() => setConnectProvider(provider)}
										onManage={(connection) => setManageConnection(connection)}
									/>
								))}
							</div>
						)}
					</Section>
				</div>

				<ConnectProviderDialog
					provider={connectProvider}
					onOpenChange={(open) => !open && setConnectProvider(null)}
				/>

				{manageProvider && (
					<ManageConnectionDialog
						provider={manageProvider}
						connection={
							connections.find((c) => c.id === manageConnection?.id) ?? null
						}
						onOpenChange={(open) => !open && setManageConnection(null)}
					/>
				)}
			</PageContent>
		</PageContainer>
	);
}

interface SectionProps {
	title: string;
	description?: string;
	children: React.ReactNode;
}

function Section({ title, description, children }: SectionProps) {
	return (
		<div className="grid grid-cols-1 gap-4 py-8 first:pt-0 last:pb-0 md:grid-cols-[220px_1fr] md:gap-10">
			<div>
				<h2 className="text-base font-semibold">{title}</h2>
				{description && (
					<p className="mt-1 text-sm text-muted-foreground">{description}</p>
				)}
			</div>
			<div className="min-w-0">{children}</div>
		</div>
	);
}

function ProfileSection() {
	const router = useRouter();
	const { data: session } = useSession();
	const [isSigningOut, setIsSigningOut] = useState(false);

	const email = session?.data?.user?.email;

	const onSignOut = async () => {
		setIsSigningOut(true);
		try {
			await authClient.signOut();
			router.push("/login");
		} finally {
			setIsSigningOut(false);
		}
	};

	return (
		<div className="flex items-center justify-between gap-4 text-sm">
			<div className="min-w-0">
				<div className="text-muted-foreground">Signed in as</div>
				<div className="truncate">{email ?? "—"}</div>
			</div>
			<Button
				variant="outline"
				size="sm"
				onClick={onSignOut}
				disabled={isSigningOut}
			>
				{isSigningOut ? "Signing out…" : "Sign out"}
			</Button>
		</div>
	);
}

function AppearanceSection() {
	const { theme, setTheme } = useTheme();
	return (
		<div className="flex items-center justify-between gap-4 text-sm">
			<label htmlFor="theme">Theme</label>
			<NativeSelect
				id="theme"
				className="w-40"
				value={theme ?? "system"}
				onChange={(e) => setTheme(e.target.value)}
			>
				<option value="light">Light</option>
				<option value="dark">Dark</option>
				<option value="system">System</option>
			</NativeSelect>
		</div>
	);
}

interface ProviderRowProps {
	provider: Provider;
	connection: Connection | null;
	onConnect: () => void;
	onManage: (connection: Connection) => void;
}

function ProviderRow({
	provider,
	connection,
	onConnect,
	onManage,
}: ProviderRowProps) {
	const isConnected = !!connection;
	const comingSoon = provider.comingSoon && !isConnected;

	const lastSyncedDate = timestampToDate(connection?.lastSynced);
	const statusLine = connection
		? lastSyncedDate
			? `Synced ${formatDistanceToNow(lastSyncedDate, { addSuffix: true })} · ${intervalLabel(connection.syncIntervalMinutes)}`
			: `Never synced · ${intervalLabel(connection.syncIntervalMinutes)}`
		: comingSoon
			? "Coming soon"
			: provider.description;

	return (
		<div className="flex items-center gap-4 py-3 text-sm">
			<div className="min-w-0 flex-1">
				<div className="font-medium">
					{provider.label}
					{isConnected && connection.status !== "active" && (
						<span
							className={cn(
								"ml-2 font-normal",
								connection.status === "broken"
									? "text-destructive"
									: "text-muted-foreground",
							)}
						>
							{connection.status}
						</span>
					)}
				</div>
				<div className="truncate text-muted-foreground">{statusLine}</div>
			</div>
			{isConnected ? (
				<Button
					variant="outline"
					size="sm"
					onClick={() => onManage(connection)}
				>
					Manage
				</Button>
			) : (
				<Button
					variant="outline"
					size="sm"
					onClick={onConnect}
					disabled={comingSoon}
				>
					Connect
				</Button>
			)}
		</div>
	);
}
