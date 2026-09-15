import { useQuery } from "@tanstack/react-query";
import {
	addDays,
	addMonths,
	differenceInCalendarDays,
	endOfMonth,
	getDaysInMonth,
	isSameMonth,
	startOfDay,
	startOfMonth,
	subMonths,
} from "date-fns";
import type { Account } from "@/gen/nagomi/v1/account_pb";
import { AccountType, TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import { ReceiptStatus } from "@/gen/nagomi/v1/receipt_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";
import { transactionsApi } from "@/lib/api/transactions";
import { formatAmount } from "@/lib/utils/transaction";
import { useAccounts } from "./useAccounts";
import { useCategories } from "./useCategories";
import { useConnections } from "./useConnections";
import { useReceipts } from "./useReceipts";
import { useUserId } from "./useSession";
import { useFriendBalances } from "./useSplits";
import { useUncategorizedCount } from "./useTransactionsQuery";

const { DIRECTION_INCOMING: IN, DIRECTION_OUTGOING: OUT } =
	TransactionDirection;
const MOVES = new Set(["transfers", "investing"]);
const LOOKBACK_MONTHS = 3;

export interface PacePoint {
	day: number;
	current?: number;
	typical: number;
}
export interface CategorySpend {
	slug: string;
	color?: string;
	amount: number;
	average: number;
}
export interface Recurring {
	merchant: string;
	direction: TransactionDirection;
	amount: number;
	approximate: boolean;
	next: Date;
	cadence: "weekly" | "biweekly" | "monthly";
}
export interface AccountRow {
	account: Account;
	balance: number;
	series: number[];
}
export interface Attention {
	kind: "uncategorized" | "receipts" | "friend" | "sync";
	text: string;
	href: string;
	amount?: number;
}

const txDate = (t: Transaction) =>
	new Date(Number(t.txDate?.seconds ?? BigInt(0)) * 1000);
const median = (xs: number[]) => {
	const s = [...xs].sort((a, b) => a - b);
	return s.length % 2
		? s[(s.length - 1) / 2]
		: (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const topSlug = (slug?: string) => slug?.split(".")[0];

async function fetchAll(userId: string, startDate: Date, endDate: Date) {
	const out: Transaction[] = [];
	let cursor: Awaited<ReturnType<typeof transactionsApi.list>>["nextCursor"];
	for (let i = 0; i < 40; i++) {
		const page = await transactionsApi.list({
			userId,
			limit: 500,
			startDate,
			endDate,
			cursor,
		});
		out.push(...page.transactions);
		if (!page.hasMore) break;
		cursor = page.nextCursor;
	}
	return out;
}

export function useOverview(month: Date) {
	const userId = useUserId();
	const today = startOfDay(new Date());
	const monthStart = startOfMonth(month);
	const monthEnd = endOfMonth(month);
	const current = isSameMonth(month, today);
	const rangeStart = startOfMonth(subMonths(monthStart, LOOKBACK_MONTHS));
	const rangeEnd = monthEnd > today ? monthEnd : today;

	const { accounts, isLoading: accountsLoading } = useAccounts();
	const { categoryMap, categories } = useCategories();
	const { connections } = useConnections();
	const receipts = useReceipts({ unlinkedOnly: true });
	const friends = useFriendBalances();
	const uncategorized = useUncategorizedCount();

	const txQuery = useQuery({
		queryKey: ["transactions", "overview", userId, rangeStart.toISOString()],
		queryFn: () => fetchAll(userId as string, rangeStart, addDays(rangeEnd, 1)),
		enabled: !!userId,
		staleTime: 60 * 1000,
	});

	const isLoading = accountsLoading || txQuery.isLoading;
	const error = txQuery.error;
	const txs = txQuery.data ?? [];

	const real = accounts.filter((a) => a.type !== AccountType.ACCOUNT_FRIEND);
	const realIds = new Set(real.map((a) => a.id));
	const currency = real[0]?.mainCurrency ?? "USD";
	const slugOf = (t: Transaction) =>
		t.category?.slug ?? categoryMap.get(t.categoryId?.toString() ?? "")?.slug;
	const isMove = (t: Transaction) => MOVES.has(topSlug(slugOf(t)) ?? "");
	const spend = (t: Transaction) =>
		t.direction === OUT && realIds.has(t.accountId) && !isMove(t);
	const income = (t: Transaction) =>
		t.direction === IN && realIds.has(t.accountId) && !isMove(t);

	const inMonth = (t: Transaction, m: Date) => isSameMonth(txDate(t), m);
	const sum = (xs: Transaction[]) =>
		xs.reduce((n, t) => n + formatAmount(t.txAmount), 0);

	// cumulative-by-day for one month, padded to `days`
	const cumulative = (
		m: Date,
		pred: (t: Transaction) => boolean,
		days: number,
	) => {
		const daily = new Array<number>(days).fill(0);
		for (const t of txs) {
			if (!pred(t) || !inMonth(t, m)) continue;
			const d = txDate(t).getDate() - 1;
			if (d < days) daily[d] += formatAmount(t.txAmount);
		}
		let acc = 0;
		return daily.map((v) => (acc += v));
	};

	const daysInMonth = getDaysInMonth(monthStart);
	const throughDay = current
		? today.getDate()
		: monthEnd < today
			? daysInMonth
			: 0;
	const cur = cumulative(monthStart, spend, daysInMonth);
	const prior = Array.from({ length: LOOKBACK_MONTHS }, (_, i) =>
		subMonths(monthStart, i + 1),
	).filter((m) => m >= rangeStart && m < monthStart);
	const priorCum = prior.map((m) => cumulative(m, spend, 31));
	const typicalAt = (day: number) =>
		priorCum.length
			? priorCum.reduce((n, c) => n + c[Math.min(day, c.length) - 1], 0) /
				priorCum.length
			: 0;

	const pace: PacePoint[] = Array.from({ length: daysInMonth }, (_, i) => ({
		day: i + 1,
		current: i < throughDay ? cur[i] : undefined,
		typical: typicalAt(i + 1),
	}));
	const spent = throughDay ? cur[throughDay - 1] : 0;
	const typicalNow = typicalAt(Math.max(throughDay, 1));
	const typicalMonth = typicalAt(daysInMonth);
	const incomeMonth = sum(
		txs.filter((t) => income(t) && inMonth(t, monthStart)),
	);

	// categories, this month vs average of prior months
	const byTop = new Map<string, CategorySpend>();
	const add = (key: string, amount: number, avg: boolean) => {
		const row = byTop.get(key) ?? {
			slug: key,
			color: categories.find((c) => c.slug === key)?.color,
			amount: 0,
			average: 0,
		};
		if (avg) row.average += amount / Math.max(priorCum.length, 1);
		else row.amount += amount;
		byTop.set(key, row);
	};
	const cutDay = current ? throughDay : 31;
	for (const t of txs) {
		if (!spend(t)) continue;
		const key = topSlug(slugOf(t)) ?? "uncategorized";
		const d = txDate(t);
		if (isSameMonth(d, monthStart)) add(key, formatAmount(t.txAmount), false);
		else if (d.getDate() <= cutDay && prior.some((m) => isSameMonth(d, m)))
			add(key, formatAmount(t.txAmount), true);
	}
	const whereItWent = [...byTop.values()]
		.filter((c) => c.amount > 0 || c.average > 0)
		.sort((a, b) => b.amount - a.amount);

	// recurring: same merchant, steady cadence, next occurrence in the next 30 days
	const groups = new Map<string, Transaction[]>();
	for (const t of txs) {
		if (!realIds.has(t.accountId) || isMove(t) || !t.merchant) continue;
		if (txDate(t) > today) continue;
		const key = `${t.direction}:${t.merchant}`;
		groups.set(key, [...(groups.get(key) ?? []), t]);
	}
	const upcoming: Recurring[] = [];
	for (const list of groups.values()) {
		if (list.length < 3) continue;
		const sorted = [...list].sort((a, b) => +txDate(a) - +txDate(b));
		const gaps = sorted
			.slice(1)
			.map((t, i) => differenceInCalendarDays(txDate(t), txDate(sorted[i])))
			.filter((g) => g > 0);
		if (gaps.length < 2) continue;
		const gap = median(gaps);
		const cadence =
			gap >= 26 && gap <= 33
				? "monthly"
				: gap >= 12 && gap <= 16
					? "biweekly"
					: gap >= 6 && gap <= 8
						? "weekly"
						: null;
		if (!cadence) continue;
		// short cadences need more evidence and steady amounts; bills may vary
		const minGaps = cadence === "monthly" ? 2 : 3;
		const amountTolerance = cadence === "monthly" ? 0.35 : 0.1;
		if (gaps.length < minGaps) continue;
		if (gaps.some((g) => Math.abs(g - gap) > Math.max(2, gap * 0.15))) continue;
		const amounts = sorted.map((t) => formatAmount(t.txAmount));
		const amount = median(amounts);
		if (amounts.some((a) => Math.abs(a - amount) > amount * amountTolerance))
			continue;
		const approximate = amounts.some(
			(a) => Math.abs(a - amount) > amount * 0.05,
		);
		const step = (d: Date) =>
			cadence === "monthly" ? addMonths(d, 1) : addDays(d, gap);
		let next = step(txDate(sorted[sorted.length - 1]));
		while (next < today) next = step(next);
		if (differenceInCalendarDays(next, today) > 30) continue;
		const last = sorted[sorted.length - 1];
		upcoming.push({
			merchant: last.merchant as string,
			direction: last.direction,
			amount,
			approximate,
			next: startOfDay(next),
			cadence,
		});
	}
	upcoming.sort((a, b) => +a.next - +b.next);

	// accounts with a 30-day balance series, walked back from today's balance
	const accountRows: AccountRow[] = real
		.map((account) => {
			const balance = formatAmount(account.balance);
			const mine = txs.filter((t) => t.accountId === account.id);
			const series: number[] = [];
			for (let i = 29; i >= 0; i--) {
				const cut = addDays(today, -i + 1);
				const after = mine
					.filter((t) => txDate(t) >= cut)
					.reduce(
						(n, t) =>
							n + (t.direction === IN ? 1 : -1) * formatAmount(t.txAmount),
						0,
					);
				series.push(balance - after);
			}
			return { account, balance, series };
		})
		.sort((a, b) => a.account.type - b.account.type);

	const netWorth = accountRows.reduce((n, r) => n + r.balance, 0);
	const netWorth30 = accountRows.reduce((n, r) => n + r.series[0], 0);
	const cash = accountRows
		.filter((r) =>
			[
				AccountType.ACCOUNT_CHEQUING,
				AccountType.ACCOUNT_SAVINGS,
				AccountType.ACCOUNT_CREDIT_CARD,
			].includes(r.account.type),
		)
		.reduce((n, r) => n + r.balance, 0);

	const nextPayday = upcoming.find((u) => u.direction === IN);

	const attention: Attention[] = [];
	if (uncategorized.data)
		attention.push({
			kind: "uncategorized",
			text: `${uncategorized.data} uncategorized transaction${uncategorized.data === 1 ? "" : "s"}`,
			href: "/transactions?uncategorized=1",
		});
	const unlinked = (receipts.receipts ?? []).filter(
		(r) => r.status !== ReceiptStatus.FAILED,
	).length;
	if (unlinked)
		attention.push({
			kind: "receipts",
			text: `${unlinked} receipt${unlinked === 1 ? "" : "s"} not linked to a transaction`,
			href: "/receipts",
		});
	for (const f of friends.data ?? []) {
		const b = formatAmount(f.balance);
		if (!b) continue;
		attention.push({
			kind: "friend",
			text: b > 0 ? `${f.friendName} owes you` : `You owe ${f.friendName}`,
			href: "/friends",
			amount: Math.abs(b),
		});
	}
	for (const c of connections) {
		const last = c.lastSynced
			? new Date(Number(c.lastSynced.seconds) * 1000)
			: undefined;
		const days = last ? differenceInCalendarDays(today, last) : undefined;
		if (c.status !== "active" || days === undefined || days >= 2)
			attention.push({
				kind: "sync",
				text:
					c.status !== "active"
						? `${c.provider} connection is ${c.status}`
						: `${c.provider} last synced ${days} days ago`,
				href: "/settings",
			});
	}

	return {
		isLoading,
		error,
		currency,
		current,
		throughDay,
		daysInMonth,
		netWorth,
		netWorthDelta: netWorth - netWorth30,
		spent,
		typicalNow,
		typicalMonth,
		incomeMonth,
		cash,
		nextPayday,
		pace,
		priorMonths: priorCum.length,
		whereItWent,
		upcoming,
		accountRows,
		attention,
	};
}
