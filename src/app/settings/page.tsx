"use client";

import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import { Card, HStack, LoadingSkeleton, Muted, VStack } from "@/components/lib";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	PageContainer,
	PageContent,
	PageHeaderWithTitle,
} from "@/components/ui/layout";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Connection } from "@/gen/nagomi/v1/connection_services_pb";
import { useConnections } from "@/hooks/useConnections";
import { useSession, useUserId } from "@/hooks/useSession";
import { authClient } from "@/lib/auth-client";
import { ConnectProviderDialog } from "./components/ConnectProviderDialog";
import { ManageConnectionDialog } from "./components/ManageConnectionDialog";
import { intervalLabel, PROVIDERS, type Provider } from "./providers";

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

export default function SettingsPage() {
	const userId = useUserId();
	const { connections, isLoading } = useConnections();

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

				<div className="divide-y divide-border">
					<Section title="profile" description="signed-in account and session.">
						<ProfileSection />
					</Section>

					<Section title="appearance" description="theme used on this device.">
						<AppearanceSection />
					</Section>

					<Section
						title="connections"
						description="pull transactions from outside accounts on a schedule."
					>
						{!userId || isLoading ? (
							<LoadingSkeleton />
						) : (
							<VStack spacing="sm">
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
							</VStack>
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
						connection={manageConnection}
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
		<div className="grid grid-cols-1 gap-6 py-8 md:grid-cols-[220px_1fr] md:gap-10 first:pt-0 last:pb-0">
			<div>
				<h2 className="font-serif text-lg font-semibold">{title}</h2>
				{description && (
					<Muted size="xs" className="mt-1 block">
						{description}
					</Muted>
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
		<Card padding="md">
			<HStack justify="between" align="center">
				<VStack spacing="xs" className="min-w-0">
					<Muted size="xs">signed in as</Muted>
					<span className="truncate font-mono text-sm">{email ?? "—"}</span>
				</VStack>
				<Button
					variant="outline"
					size="sm"
					onClick={onSignOut}
					disabled={isSigningOut}
				>
					{isSigningOut ? "signing out..." : "sign out"}
				</Button>
			</HStack>
		</Card>
	);
}

function AppearanceSection() {
	const { theme, setTheme } = useTheme();
	return (
		<Card padding="md">
			<HStack justify="between" align="center">
				<span className="text-sm">theme</span>
				<Select value={theme ?? "system"} onValueChange={setTheme}>
					<SelectTrigger className="w-[160px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="light">light</SelectItem>
						<SelectItem value="dark">dark</SelectItem>
						<SelectItem value="system">system</SelectItem>
					</SelectContent>
				</Select>
			</HStack>
		</Card>
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
			? `synced ${formatDistanceToNow(lastSyncedDate, { addSuffix: true })} · ${intervalLabel(connection.syncIntervalMinutes)}`
			: `never synced · ${intervalLabel(connection.syncIntervalMinutes)}`
		: comingSoon
			? "coming soon"
			: provider.description;

	return (
		<Card
			padding="md"
			interactive={isConnected}
			onClick={connection ? () => onManage(connection) : undefined}
		>
			<HStack justify="between" align="center">
				<VStack spacing="xs" className="min-w-0 flex-1">
					<HStack spacing="sm" align="center">
						<span className="font-medium">{provider.label}</span>
						{isConnected && (
							<Badge variant={STATUS_VARIANT[connection.status] ?? "outline"}>
								{connection.status}
							</Badge>
						)}
					</HStack>
					<Muted size="xs" className="truncate">
						{statusLine}
					</Muted>
				</VStack>
				{isConnected ? (
					<Button
						variant="outline"
						size="sm"
						onClick={() => onManage(connection)}
					>
						manage
					</Button>
				) : (
					<Button size="sm" onClick={onConnect} disabled={comingSoon}>
						connect
					</Button>
				)}
			</HStack>
		</Card>
	);
}
