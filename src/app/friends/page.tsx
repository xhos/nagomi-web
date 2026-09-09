"use client";

import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card, HStack, Muted, Text, VStack } from "@/components/lib";
import { Button } from "@/components/ui/button";
import {
	PageContainer,
	PageContent,
	PageHeaderWithTitle,
} from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountType } from "@/gen/nagomi/v1/enums_pb";
import type { FriendBalance } from "@/gen/nagomi/v1/transaction_services_pb";
import { useAccounts } from "@/hooks/useAccounts";
import { useFriendBalances } from "@/hooks/useSplits";
import { formatCurrency } from "@/lib/utils/transaction";
import { FriendDetail } from "./components/FriendDetail";

function OverviewTab({
	balances,
	totalOwed,
	totalOwedCurrency,
	onSelectFriend,
}: {
	balances: FriendBalance[];
	totalOwed: number;
	totalOwedCurrency: string;
	onSelectFriend: (accountId: string) => void;
}) {
	const friendsOwingYou = balances.filter((b) => {
		const a =
			Number(b.balance?.units ?? BigInt(0)) + (b.balance?.nanos ?? 0) / 1e9;
		return a > 0.001;
	});
	const friendsYouOwe = balances.filter((b) => {
		const a =
			Number(b.balance?.units ?? BigInt(0)) + (b.balance?.nanos ?? 0) / 1e9;
		return a < -0.001;
	});
	const settled = balances.filter((b) => {
		const a =
			Number(b.balance?.units ?? BigInt(0)) + (b.balance?.nanos ?? 0) / 1e9;
		return Math.abs(a) <= 0.001;
	});

	return (
		<VStack spacing="lg">
			{totalOwed > 0.001 && (
				<HStack spacing="xs" align="baseline">
					<Text size="sm" weight="medium">
						{formatCurrency(totalOwed, totalOwedCurrency)}
					</Text>
					<Muted size="xs">owed to you</Muted>
				</HStack>
			)}

			{balances.length === 0 ? (
				<Muted size="sm">no outstanding balances</Muted>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{[...friendsOwingYou, ...friendsYouOwe, ...settled].map((balance) => {
						const rawAmount =
							Number(balance.balance?.units ?? BigInt(0)) +
							(balance.balance?.nanos ?? 0) / 1e9;
						const currencyCode = balance.balance?.currencyCode;
						const isOwing = rawAmount > 0.001;
						const isOwe = rawAmount < -0.001;

						return (
							<Card
								key={balance.accountId.toString()}
								variant="default"
								padding="md"
								interactive
								onClick={() => onSelectFriend(balance.accountId.toString())}
							>
								<VStack spacing="md" align="start">
									<HStack spacing="md" justify="between" className="w-full">
										<Text size="sm">{balance.friendName}</Text>
										<Muted size="xs">
											{isOwing ? "owes you" : isOwe ? "you owe" : "settled"}
										</Muted>
									</HStack>
									<Text
										size="lg"
										weight="semibold"
										className={
											isOwing
												? "font-mono text-emerald-600 dark:text-emerald-400"
												: isOwe
													? "font-mono text-destructive"
													: "text-muted-foreground"
										}
									>
										{isOwing
											? formatCurrency(rawAmount, currencyCode)
											: isOwe
												? formatCurrency(Math.abs(rawAmount), currencyCode)
												: "settled"}
									</Text>
								</VStack>
							</Card>
						);
					})}
				</div>
			)}
		</VStack>
	);
}

export default function FriendsPage() {
	const { data: balances = [], isLoading } = useFriendBalances();
	const { accounts } = useAccounts();
	const [activeTab, setActiveTab] = useState("overview");

	const friendAccounts = accounts.filter(
		(a) => a.type === AccountType.ACCOUNT_FRIEND,
	);

	const totalOwed = balances.reduce((sum, b) => {
		const amount =
			Number(b.balance?.units ?? BigInt(0)) + (b.balance?.nanos ?? 0) / 1e9;
		return sum + Math.max(0, amount);
	}, 0);

	const totalOwedCurrency =
		balances.find((b) => b.balance?.currencyCode)?.balance?.currencyCode ??
		"USD";

	if (isLoading) {
		return (
			<PageContainer>
				<PageContent>
					<PageHeaderWithTitle title="friends" />
					<Muted size="sm">loading...</Muted>
				</PageContent>
			</PageContainer>
		);
	}

	if (friendAccounts.length === 0) {
		return (
			<PageContainer>
				<PageContent>
					<PageHeaderWithTitle title="friends" />
					<VStack spacing="md" align="center" className="py-16">
						<Users className="h-10 w-10 text-muted-foreground/30" />
						<VStack spacing="xs" align="center">
							<div className="text-sm font-medium">no friends yet</div>
							<Muted size="sm">
								create a friend account to start tracking shared expenses
							</Muted>
						</VStack>
						<Button asChild size="sm" variant="outline">
							<Link href="/accounts">
								<Plus className="h-3.5 w-3.5 mr-1.5" />
								add friend account
							</Link>
						</Button>
					</VStack>
				</PageContent>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageContent>
				<PageHeaderWithTitle title="friends" />

				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="mb-6">
						<TabsTrigger value="overview">overview</TabsTrigger>
						{balances.map((b) => (
							<TabsTrigger
								key={b.accountId.toString()}
								value={b.accountId.toString()}
							>
								{b.friendName}
							</TabsTrigger>
						))}
					</TabsList>

					<TabsContent value="overview">
						<OverviewTab
							balances={balances}
							totalOwed={totalOwed}
							totalOwedCurrency={totalOwedCurrency}
							onSelectFriend={setActiveTab}
						/>
					</TabsContent>

					{balances.map((balance) => (
						<TabsContent
							key={balance.accountId.toString()}
							value={balance.accountId.toString()}
						>
							<FriendDetail balance={balance} />
						</TabsContent>
					))}
				</Tabs>
			</PageContent>
		</PageContainer>
	);
}
