import {
	clone,
	create,
	type DescMethodUnary,
	type DescService,
	type MessageShape,
} from "@bufbuild/protobuf";
import type { Client } from "@connectrpc/connect";
import { AccountSchema } from "@/gen/nagomi/v1/account_pb";
import {
	AccountService,
	AddAccountAliasResponseSchema,
	CreateAccountResponseSchema,
	DeleteAccountResponseSchema,
	FindAccountByAliasResponseSchema,
	ListAccountsResponseSchema,
	MergeAccountsResponseSchema,
	RemoveAccountAliasResponseSchema,
	SetAccountAliasesResponseSchema,
	UpdateAccountResponseSchema,
} from "@/gen/nagomi/v1/account_services_pb";
import { CategorySchema } from "@/gen/nagomi/v1/category_pb";
import {
	CategoryService,
	CreateCategoryResponseSchema,
	DeleteCategoryResponseSchema,
	ListCategoriesResponseSchema,
	UpdateCategoryResponseSchema,
} from "@/gen/nagomi/v1/category_services_pb";
import {
	ConnectionSchema,
	ConnectionsService,
	CreateConnectionResponseSchema,
	DeleteConnectionResponseSchema,
	ListConnectionsResponseSchema,
	SetSyncIntervalResponseSchema,
	TriggerSyncResponseSchema,
} from "@/gen/nagomi/v1/connection_services_pb";
import {
	DashboardService,
	GetCategorySpendingComparisonResponseSchema,
	GetCurrenciesResponseSchema,
	GetDashboardSummaryResponseSchema,
	GetFinancialSummaryResponseSchema,
	GetNetWorthHistoryResponseSchema,
} from "@/gen/nagomi/v1/dashboard_services_pb";
import {
	AccountType,
	Granularity,
	PeriodType,
	TransactionDirection,
} from "@/gen/nagomi/v1/enums_pb";
import { ReceiptSchema, ReceiptStatus } from "@/gen/nagomi/v1/receipt_pb";
import {
	DeleteReceiptResponseSchema,
	GetReceiptResponseSchema,
	ListReceiptsResponseSchema,
	ReceiptService,
	RetryParseReceiptResponseSchema,
	UpdateReceiptResponseSchema,
	UploadReceiptResponseSchema,
} from "@/gen/nagomi/v1/receipt_services_pb";
import { RuleSchema } from "@/gen/nagomi/v1/rule_pb";
import {
	CreateRuleResponseSchema,
	DeleteRuleResponseSchema,
	ListRulesResponseSchema,
	RuleService,
	UpdateRuleResponseSchema,
} from "@/gen/nagomi/v1/rule_services_pb";
import {
	type Transaction,
	TransactionSchema,
} from "@/gen/nagomi/v1/transaction_pb";
import {
	CreateTransactionResponseSchema,
	DeleteTransactionResponseSchema,
	ForgiveTransactionResponseSchema,
	GetFriendBalancesResponseSchema,
	ListTransactionsResponseSchema,
	SplitTransactionResponseSchema,
	TransactionService,
	UpdateTransactionResponseSchema,
} from "@/gen/nagomi/v1/transaction_services_pb";
import {
	cents,
	DEMO_USER,
	db,
	fromPdate,
	money,
	nextId,
	pdate,
	syncBalances,
	ts,
} from "./data";

const { DIRECTION_INCOMING: IN, DIRECTION_OUTGOING: OUT } =
	TransactionDirection;

// only the rpcs the api layer calls are implemented; anything else rejects loudly.
// requests are normalized through the method's input schema so handlers see full messages.
type Impl<T extends DescService> = {
	[P in keyof T["method"]]?: T["method"][P] extends DescMethodUnary<
		infer I,
		infer O
	>
		? (req: MessageShape<I>) => Promise<MessageShape<O>>
		: never;
};
function fake<T extends DescService>(svc: T, impl: Impl<T>): Client<T> {
	return new Proxy({} as Client<T>, {
		get: (_, k) => {
			const fn = (impl as Record<string | symbol, unknown>)[k] as
				| ((r: unknown) => Promise<unknown>)
				| undefined;
			const m = (svc.method as Record<string, DescMethodUnary>)[String(k)];
			if (!fn || !m)
				return () =>
					Promise.reject(new Error(`demo: ${String(k)} not implemented`));
			return (req: unknown) => fn(create(m.input, req as never));
		},
	});
}

const now = () => ts(new Date());
const tsDay = (t?: { seconds: bigint }) => {
	const d = new Date(secs(t) * 1000);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
};
const secs = (t?: { seconds: bigint }) => Number(t?.seconds ?? BigInt(0));
const account = (id: bigint) => db.accounts.find((a) => a.id === id);
const category = (id?: bigint) => db.categories.find((c) => c.id === id);
const byDateDesc = (a: Transaction, b: Transaction) =>
	secs(b.txDate) - secs(a.txDate) || Number(b.id - a.id);

// hydrate joined fields the way core does on read
function view(t: Transaction): Transaction {
	const v = clone(TransactionSchema, t);
	const acc = account(t.accountId);
	v.category = category(t.categoryId);
	v.accountName = acc?.friendlyName ?? acc?.name;
	v.splits =
		t.splitFromId === undefined
			? db.transactions
					.filter((s) => s.splitFromId === t.id)
					.map((s) => clone(TransactionSchema, s))
			: [];
	return v;
}

function removeTransactions(ids: bigint[]) {
	const gone = new Set(ids.map(String));
	const touched = new Set<bigint>();
	db.transactions = db.transactions.filter((t) => {
		const drop =
			gone.has(String(t.id)) ||
			(t.splitFromId !== undefined && gone.has(String(t.splitFromId)));
		if (drop) touched.add(t.accountId);
		return !drop;
	});
	for (const id of touched) syncBalances(id);
	return touched.size;
}

export const accountClient = fake(AccountService, {
	async listAccounts() {
		return create(ListAccountsResponseSchema, { accounts: db.accounts });
	},
	async createAccount(req) {
		const a = create(AccountSchema, {
			id: nextId(),
			ownerId: DEMO_USER.id,
			name: req.name,
			bank: req.bank,
			type: req.type,
			friendlyName: req.friendlyName,
			mainCurrency: req.mainCurrency || "CAD",
			colors: req.colors ?? [],
			anchorBalance: money(cents(req.anchorBalance), req.mainCurrency || "CAD"),
			anchorDate: now(),
			createdAt: now(),
			updatedAt: now(),
		});
		db.accounts.push(a);
		syncBalances(a.id);
		return create(CreateAccountResponseSchema, { account: a });
	},
	async updateAccount(req) {
		const a = account(req.id);
		if (!a) throw new Error("account not found");
		for (const p of req.updateMask?.paths ?? []) {
			if (p === "name" && req.name !== undefined) a.name = req.name;
			if (p === "bank" && req.bank !== undefined) a.bank = req.bank;
			if (p === "account_type" && req.accountType !== undefined)
				a.type = req.accountType;
			if (p === "friendly_name") a.friendlyName = req.friendlyName;
			if (p === "main_currency" && req.mainCurrency)
				a.mainCurrency = req.mainCurrency;
			if (p === "colors" && req.colors.length) a.colors = req.colors;
			if (p === "anchor_balance" && req.anchorBalance)
				a.anchorBalance = money(cents(req.anchorBalance), a.mainCurrency);
			if (p === "anchor_date" && req.anchorDate) a.anchorDate = req.anchorDate;
		}
		a.updatedAt = now();
		syncBalances(a.id);
		return create(UpdateAccountResponseSchema, {});
	},
	async deleteAccount(req) {
		removeTransactions(
			db.transactions.filter((t) => t.accountId === req.id).map((t) => t.id),
		);
		db.accounts = db.accounts.filter((a) => a.id !== req.id);
		return create(DeleteAccountResponseSchema, { affectedRows: BigInt(1) });
	},
	async addAccountAlias(req) {
		const a = account(req.accountId);
		if (a && !a.aliases.includes(req.alias)) a.aliases.push(req.alias);
		return create(AddAccountAliasResponseSchema, {});
	},
	async removeAccountAlias(req) {
		const a = account(req.accountId);
		if (a) a.aliases = a.aliases.filter((x) => x !== req.alias);
		return create(RemoveAccountAliasResponseSchema, {});
	},
	async setAccountAliases(req) {
		const a = account(req.accountId);
		if (a) a.aliases = [...req.aliases];
		return create(SetAccountAliasesResponseSchema, {});
	},
	async findAccountByAlias(req) {
		return create(FindAccountByAliasResponseSchema, {
			account: db.accounts.find((a) => a.aliases.includes(req.alias)),
		});
	},
	async mergeAccounts(req) {
		let moved = BigInt(0);
		for (const t of db.transactions)
			if (t.accountId === req.secondaryAccountId) {
				t.accountId = req.primaryAccountId;
				moved++;
			}
		db.accounts = db.accounts.filter((a) => a.id !== req.secondaryAccountId);
		syncBalances(req.primaryAccountId);
		return create(MergeAccountsResponseSchema, {
			account: account(req.primaryAccountId),
			transactionsMoved: moved,
		});
	},
});

export const transactionClient = fake(TransactionService, {
	async listTransactions(r) {
		const min = r.amountMin ? cents(r.amountMin) : undefined;
		const max = r.amountMax ? cents(r.amountMax) : undefined;
		const mq = r.merchantQuery?.toLowerCase();
		const dq = r.descriptionQuery?.toLowerCase();
		const slugs = new Set(r.categories);
		let xs = db.transactions.filter((t) => {
			const amt = cents(t.txAmount);
			const d = secs(t.txDate);
			return (
				(r.accountId === undefined || t.accountId === r.accountId) &&
				(!r.accountIds.length || r.accountIds.includes(t.accountId)) &&
				(!r.startDate || d >= secs(r.startDate)) &&
				(!r.endDate || d <= secs(r.endDate)) &&
				(min === undefined || amt >= min) &&
				(max === undefined || amt <= max) &&
				(!r.direction || t.direction === r.direction) &&
				(!slugs.size || slugs.has(category(t.categoryId)?.slug ?? "")) &&
				(!mq || (t.merchant ?? "").toLowerCase().includes(mq)) &&
				(!dq || (t.description ?? "").toLowerCase().includes(dq)) &&
				(!r.currency || t.txAmount?.currencyCode === r.currency) &&
				(r.uncategorized !== true || t.categoryId === undefined)
			);
		});
		xs.sort(byDateDesc);
		if (r.cursor?.date && r.cursor.id !== undefined) {
			const cd = secs(r.cursor.date);
			const ci = r.cursor.id;
			xs = xs.filter(
				(t) => secs(t.txDate) < cd || (secs(t.txDate) === cd && t.id < ci),
			);
		}
		const limit = r.limit || 50;
		const page = xs.slice(0, limit);
		const last = page[page.length - 1];
		return create(ListTransactionsResponseSchema, {
			transactions: page.map(view),
			totalCount: BigInt(xs.length),
			nextCursor:
				xs.length > limit && last
					? { date: last.txDate, id: last.id }
					: undefined,
		});
	},
	async createTransaction(r) {
		const made: Transaction[] = [];
		for (const i of r.transactions) {
			const acc = account(i.accountId);
			const t = create(TransactionSchema, {
				id: nextId(),
				accountId: i.accountId,
				txDate: i.txDate,
				txAmount: money(
					cents(i.txAmount),
					i.txAmount?.currencyCode || acc?.mainCurrency,
				),
				direction: i.direction,
				description: i.description,
				merchant: i.merchant,
				userNotes: i.userNotes,
				categoryId: i.categoryId,
				foreignAmount: i.foreignAmount,
				exchangeRate: i.exchangeRate,
				splitFromId: i.splitFromId,
				externalId: i.externalId,
				categoryManuallySet: i.categoryId !== undefined,
				merchantManuallySet: !!i.merchant,
				createdAt: now(),
				updatedAt: now(),
			});
			db.transactions.push(t);
			made.push(t);
		}
		for (const id of new Set(made.map((t) => t.accountId))) syncBalances(id);
		return create(CreateTransactionResponseSchema, {
			transactions: made.map(view),
			createdCount: made.length,
		});
	},
	async updateTransaction(r) {
		const t = db.transactions.find((x) => x.id === r.id);
		if (!t) throw new Error("transaction not found");
		const before = t.accountId;
		for (const p of r.updateMask?.paths ?? []) {
			if (p === "account_id" && r.accountId !== undefined)
				t.accountId = r.accountId;
			if (p === "tx_date" && r.txDate) t.txDate = r.txDate;
			if (p === "tx_amount" && r.txAmount)
				t.txAmount = money(
					cents(r.txAmount),
					r.txAmount.currencyCode || t.txAmount?.currencyCode,
				);
			if (p === "direction" && r.direction) t.direction = r.direction;
			if (p === "description" && r.description !== undefined)
				t.description = r.description;
			if (p === "merchant" && r.merchant !== undefined) {
				t.merchant = r.merchant;
				t.merchantManuallySet = true;
			}
			if (p === "user_notes" && r.userNotes !== undefined)
				t.userNotes = r.userNotes;
			if (p === "category_id" && r.categoryId !== undefined) {
				t.categoryId = r.categoryId;
				t.categoryManuallySet = true;
			}
		}
		t.updatedAt = now();
		syncBalances(before);
		if (t.accountId !== before) syncBalances(t.accountId);
		return create(UpdateTransactionResponseSchema, {});
	},
	async deleteTransaction(req) {
		const n = removeTransactions(req.ids);
		return create(DeleteTransactionResponseSchema, { affectedRows: BigInt(n) });
	},
	async splitTransaction(r) {
		const src = db.transactions.find((t) => t.id === r.sourceTransactionId);
		if (!src) throw new Error("transaction not found");
		removeTransactions(
			db.transactions.filter((t) => t.splitFromId === src.id).map((t) => t.id),
		);
		const made = r.splits.map((s) => {
			const t = create(TransactionSchema, {
				id: nextId(),
				accountId: s.friendAccountId,
				txDate: src.txDate,
				txAmount: money(cents(s.amount), src.txAmount?.currencyCode),
				direction: IN,
				description: src.description,
				merchant: src.merchant,
				categoryId: src.categoryId,
				splitFromId: src.id,
				createdAt: now(),
				updatedAt: now(),
			});
			db.transactions.push(t);
			return t;
		});
		for (const id of new Set(made.map((t) => t.accountId))) syncBalances(id);
		return create(SplitTransactionResponseSchema, {
			createdSplits: made.map(view),
		});
	},
	async forgiveTransaction(req) {
		const t = db.transactions.find((x) => x.id === req.transactionId);
		if (t) {
			t.forgiven = !!req.forgiven;
			syncBalances(t.accountId);
		}
		return create(ForgiveTransactionResponseSchema, {});
	},
	async getFriendBalances() {
		return create(GetFriendBalancesResponseSchema, {
			balances: db.accounts
				.filter((a) => a.type === AccountType.ACCOUNT_FRIEND)
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((a) => ({
					accountId: a.id,
					friendName: a.name,
					balance: a.balance,
				})),
		});
	},
});

export const categoryClient = fake(CategoryService, {
	async listCategories() {
		return create(ListCategoriesResponseSchema, {
			categories: db.categories,
			totalCount: BigInt(db.categories.length),
		});
	},
	async createCategory(req) {
		const c = create(CategorySchema, {
			id: nextId(),
			slug: req.slug,
			color: req.color,
		});
		db.categories.push(c);
		return create(CreateCategoryResponseSchema, { category: c });
	},
	async updateCategory(r) {
		const c = category(r.id);
		if (!c) throw new Error("category not found");
		for (const p of r.updateMask?.paths ?? []) {
			if (p === "slug" && r.slug) c.slug = r.slug;
			if (p === "color" && r.color) c.color = r.color;
		}
		return create(UpdateCategoryResponseSchema, {});
	},
	async deleteCategory(req) {
		db.categories = db.categories.filter((c) => c.id !== req.id);
		for (const t of db.transactions)
			if (t.categoryId === req.id) t.categoryId = undefined;
		return create(DeleteCategoryResponseSchema, { affectedRows: BigInt(1) });
	},
});

export const ruleClient = fake(RuleService, {
	async listRules() {
		return create(ListRulesResponseSchema, {
			rules: [...db.rules].sort((a, b) => a.priorityOrder - b.priorityOrder),
		});
	},
	async createRule(req) {
		const r = create(RuleSchema, {
			ruleId: crypto.randomUUID(),
			userId: DEMO_USER.id,
			ruleName: req.ruleName,
			categoryId: req.categoryId,
			merchant: req.merchant,
			conditions: req.conditions,
			isActive: true,
			priorityOrder: db.rules.length + 1,
			ruleSource: "user_created",
			createdAt: now(),
			updatedAt: now(),
		});
		db.rules.push(r);
		return create(CreateRuleResponseSchema, { rule: r });
	},
	async updateRule(r) {
		const rule = db.rules.find((x) => x.ruleId === r.ruleId);
		if (!rule) throw new Error("rule not found");
		for (const p of r.updateMask?.paths ?? []) {
			if (p === "rule_name" && r.ruleName !== undefined)
				rule.ruleName = r.ruleName;
			if (p === "category_id") rule.categoryId = r.categoryId;
			if (p === "merchant") rule.merchant = r.merchant;
			if (p === "conditions" && r.conditions) rule.conditions = r.conditions;
			if (p === "is_active" && r.isActive !== undefined)
				rule.isActive = r.isActive;
			if (p === "priority_order" && r.priorityOrder !== undefined)
				rule.priorityOrder = r.priorityOrder;
		}
		rule.updatedAt = now();
		return create(UpdateRuleResponseSchema, {});
	},
	async deleteRule(req) {
		db.rules = db.rules.filter((r) => r.ruleId !== req.ruleId);
		return create(DeleteRuleResponseSchema, { affectedRows: BigInt(1) });
	},
});

// dashboard aggregates, computed over the in-memory store

const SPENDABLE = (t: Transaction) =>
	t.direction === OUT &&
	account(t.accountId)?.type !== AccountType.ACCOUNT_FRIEND &&
	category(t.categoryId)?.slug !== "transfers";

function periodBounds(type: PeriodType, custom?: { s?: Date; e?: Date }) {
	const end = new Date();
	end.setHours(23, 59, 59, 999);
	const day = (n: number) => {
		const d = new Date(end);
		d.setDate(d.getDate() - n);
		d.setHours(0, 0, 0, 0);
		return d;
	};
	const month = (n: number) => {
		const d = new Date(end);
		d.setMonth(d.getMonth() - n);
		d.setHours(0, 0, 0, 0);
		return d;
	};
	const span = (cs: Date, ps: Date, cl: string, pl: string) => ({
		cs,
		ce: end,
		ps,
		pe: new Date(cs.getTime() - 1),
		cl,
		pl,
	});
	switch (type) {
		case PeriodType.PERIOD_TYPE_7_DAYS:
			return span(day(6), day(13), "Last 7 Days", "Previous 7 Days");
		case PeriodType.PERIOD_TYPE_90_DAYS:
			return span(day(89), day(179), "Last 90 Days", "Previous 90 Days");
		case PeriodType.PERIOD_TYPE_3_MONTHS:
			return span(month(3), month(6), "Last 3 Months", "Previous 3 Months");
		case PeriodType.PERIOD_TYPE_6_MONTHS:
			return span(month(6), month(12), "Last 6 Months", "Previous 6 Months");
		case PeriodType.PERIOD_TYPE_1_YEAR:
			return span(month(12), month(24), "Last Year", "Previous Year");
		case PeriodType.PERIOD_TYPE_ALL_TIME:
			return span(month(12), month(24), "All Time", "Previous Period");
		case PeriodType.PERIOD_TYPE_CUSTOM: {
			const cs = custom?.s ?? day(29);
			const ce = custom?.e ?? end;
			ce.setHours(23, 59, 59, 999);
			const len = ce.getTime() - cs.getTime();
			const ps = new Date(cs.getTime() - len - 1);
			const fmt = (d: Date) =>
				d.toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
					year: "numeric",
				});
			return {
				cs,
				ce,
				ps,
				pe: new Date(cs.getTime() - 1),
				cl: `${fmt(cs)} - ${fmt(ce)}`,
				pl: `${fmt(ps)} - ${fmt(new Date(cs.getTime() - 1))}`,
			};
		}
		default:
			return span(day(29), day(59), "Last 30 Days", "Previous 30 Days");
	}
}

export const dashboardClient = fake(DashboardService, {
	async getFinancialSummary() {
		let pos = 0;
		let neg = 0;
		for (const a of db.accounts) {
			if (a.type === AccountType.ACCOUNT_FRIEND) continue;
			const b = cents(a.balance);
			if (b > 0) pos += b;
			else neg += -b;
		}
		return create(GetFinancialSummaryResponseSchema, {
			totalBalance: money(pos),
			totalDebt: money(neg),
			netBalance: money(pos - neg),
		});
	},
	async getDashboardSummary(r) {
		const s = r.startDate ? fromPdate(r.startDate).getTime() / 1000 : -Infinity;
		const e = r.endDate
			? fromPdate(r.endDate).getTime() / 1000 + 86400
			: Infinity;
		const cutoff = Date.now() / 1000 - 30 * 86400;
		const real = db.accounts.filter(
			(a) => a.type !== AccountType.ACCOUNT_FRIEND,
		);
		const ids = new Set(real.map((a) => a.id));
		const txs = db.transactions.filter(
			(t) => ids.has(t.accountId) && secs(t.txDate) >= s && secs(t.txDate) <= e,
		);
		return create(GetDashboardSummaryResponseSchema, {
			summary: {
				totalAccounts: BigInt(real.length),
				totalTransactions: BigInt(txs.length),
				totalIncome: money(
					txs
						.filter((t) => t.direction === IN)
						.reduce((n, t) => n + cents(t.txAmount), 0),
				),
				totalExpenses: money(
					txs
						.filter((t) => t.direction === OUT)
						.reduce((n, t) => n + cents(t.txAmount), 0),
				),
				transactionsLast30Days: BigInt(
					txs.filter((t) => secs(t.txDate) >= cutoff).length,
				),
				uncategorizedTransactions: BigInt(
					txs.filter((t) => t.categoryId === undefined).length,
				),
			},
		});
	},
	async getCategorySpendingComparison(r) {
		const p = periodBounds(r.periodType, {
			s: r.customStartDate && fromPdate(r.customStartDate),
			e: r.customEndDate && fromPdate(r.customEndDate),
		});
		const inRange = (t: Transaction, a: Date, b: Date) => {
			const d = secs(t.txDate) * 1000;
			return d >= a.getTime() && d <= b.getTime();
		};
		const spend = (pred: (t: Transaction) => boolean, a: Date, b: Date) => {
			const xs = db.transactions.filter(
				(t) => SPENDABLE(t) && pred(t) && inRange(t, a, b),
			);
			return {
				amount: money(xs.reduce((n, t) => n + cents(t.txAmount), 0)),
				transactionCount: BigInt(xs.length),
			};
		};
		const cmp = (pred: (t: Transaction) => boolean, categoryId?: bigint) => ({
			categoryId,
			currentPeriod: spend(pred, p.cs, p.ce),
			previousPeriod: spend(pred, p.ps, p.pe),
		});
		const cats = db.categories
			.map((c) => ({
				category: c,
				spending: cmp((t) => t.categoryId === c.id, c.id),
			}))
			.filter(
				(x) =>
					x.spending.currentPeriod.transactionCount ||
					x.spending.previousPeriod.transactionCount,
			)
			.sort(
				(a, b) =>
					cents(b.spending.currentPeriod.amount) -
					cents(a.spending.currentPeriod.amount),
			);
		const unc = cmp((t) => t.categoryId === undefined);
		return create(GetCategorySpendingComparisonResponseSchema, {
			currentPeriod: {
				startDate: pdate(p.cs),
				endDate: pdate(p.ce),
				label: p.cl,
			},
			previousPeriod: {
				startDate: pdate(p.ps),
				endDate: pdate(p.pe),
				label: p.pl,
			},
			categories: cats,
			uncategorized:
				unc.currentPeriod.transactionCount ||
				unc.previousPeriod.transactionCount
					? unc
					: undefined,
			totals: {
				currentPeriodTotal: money(
					cats.reduce((n, c) => n + cents(c.spending.currentPeriod.amount), 0) +
						cents(unc.currentPeriod.amount),
				),
				previousPeriodTotal: money(
					cats.reduce(
						(n, c) => n + cents(c.spending.previousPeriod.amount),
						0,
					) + cents(unc.previousPeriod.amount),
				),
			},
		});
	},
	async getNetWorthHistory(r) {
		if (!r.startDate || !r.endDate)
			return create(GetNetWorthHistoryResponseSchema, {});
		const step = (d: Date) => {
			const x = new Date(d);
			if (r.granularity === Granularity.MONTH) x.setMonth(x.getMonth() + 1);
			else
				x.setDate(x.getDate() + (r.granularity === Granularity.WEEK ? 7 : 1));
			return x;
		};
		const real = db.accounts.filter(
			(a) => a.type !== AccountType.ACCOUNT_FRIEND,
		);
		const sorted = [...db.transactions].sort((a, b) => -byDateDesc(a, b));
		const end = fromPdate(r.endDate);
		end.setHours(23, 59, 59, 999);
		const dataPoints = [];
		for (let d = fromPdate(r.startDate); d <= end; d = step(d)) {
			const cut =
				secs({ seconds: BigInt(Math.floor(d.getTime() / 1000)) }) + 86399;
			let nw = 0;
			for (const a of real) {
				let last: Transaction | undefined;
				for (const t of sorted)
					if (t.accountId === a.id && secs(t.txDate) <= cut) last = t;
				nw += last
					? cents(last.balanceAfter)
					: secs(a.anchorDate) <= cut
						? cents(a.anchorBalance)
						: 0;
			}
			dataPoints.push({ date: pdate(d), netWorth: money(nw) });
		}
		return create(GetNetWorthHistoryResponseSchema, { dataPoints });
	},
	async getCurrencies() {
		return create(GetCurrenciesResponseSchema, {
			currencies: [
				{ code: "CAD", name: "Canadian Dollar" },
				{ code: "USD", name: "US Dollar" },
				{ code: "EUR", name: "Euro" },
				{ code: "GBP", name: "Pound Sterling" },
				{ code: "JPY", name: "Japanese Yen" },
				{ code: "MXN", name: "Mexican Peso" },
			],
		});
	},
});

export const receiptClient = fake(ReceiptService, {
	async listReceipts(r) {
		const q = r.query?.toLowerCase();
		const s = r.startDate && fromPdate(r.startDate);
		const e = r.endDate && fromPdate(r.endDate);
		const xs = db.receipts
			.filter((x) => {
				const d = x.bestDate && fromPdate(x.bestDate);
				const total = cents(x.total);
				return (
					(!r.status || x.status === r.status) &&
					(!r.unlinkedOnly || x.transactionId === undefined) &&
					(!s || (d && d >= s)) &&
					(!e || (d && d <= e)) &&
					(!q || (x.merchant ?? "").toLowerCase().includes(q)) &&
					(r.minTotalCents === undefined || BigInt(total) >= r.minTotalCents) &&
					(r.maxTotalCents === undefined || BigInt(total) <= r.maxTotalCents) &&
					(!r.currency || x.currency === r.currency)
				);
			})
			.sort((a, b) => secs(b.createdAt) - secs(a.createdAt));
		const off = r.offset ?? 0;
		return create(ListReceiptsResponseSchema, {
			receipts: xs.slice(off, off + (r.limit || 50)),
			totalCount: BigInt(xs.length),
		});
	},
	async getReceipt(req) {
		const x = db.receipts.find((r) => r.id === req.id);
		if (!x) throw new Error("receipt not found");
		const total = cents(x.total);
		const linkCandidates =
			x.status === ReceiptStatus.PARSED && x.transactionId === undefined
				? db.transactions
						.filter(
							(t) =>
								t.direction === OUT &&
								t.receiptId === undefined &&
								Math.abs(cents(t.txAmount) - total) <= 500,
						)
						.map((t) => {
							const a = account(t.accountId);
							const days = x.bestDate
								? Math.round(
										(tsDay(t.txDate) - fromPdate(x.bestDate).getTime()) /
											86400e3,
									)
								: 0;
							return {
								transactionId: t.id,
								merchant: t.merchant ?? "",
								amount: t.txAmount,
								txDate: t.txDate,
								accountId: t.accountId,
								accountName: a?.friendlyName ?? a?.name ?? "",
								dateDiffDays: Math.abs(days),
								amountDiffCents: BigInt(Math.abs(cents(t.txAmount) - total)),
							};
						})
						.sort(
							(a, b) =>
								a.dateDiffDays - b.dateDiffDays ||
								Number(a.amountDiffCents - b.amountDiffCents),
						)
						.slice(0, 5)
				: [];
		return create(GetReceiptResponseSchema, {
			receipt: x,
			linkCandidates,
			imageData: new Uint8Array(),
		});
	},
	async uploadReceipt(req) {
		const x = create(ReceiptSchema, {
			id: nextId(),
			userId: DEMO_USER.id,
			imagePath: `receipts/${DEMO_USER.id}/${nextId()}.${req.contentType.split("/")[1] || "jpg"}`,
			status: ReceiptStatus.PENDING,
			createdAt: now(),
			updatedAt: now(),
			source: "web",
		});
		db.receipts.unshift(x);
		return create(UploadReceiptResponseSchema, { receipt: x });
	},
	async updateReceipt(r) {
		const x = db.receipts.find((y) => y.id === r.id);
		if (!x) throw new Error("receipt not found");
		if (r.transactionId !== undefined) {
			const t = db.transactions.find((y) => y.id === r.transactionId);
			x.transactionId = r.transactionId;
			x.transactionMerchant = t?.merchant;
			x.transactionAmount = t?.txAmount;
			x.status = ReceiptStatus.LINKED;
			if (t) t.receiptId = x.id;
		}
		x.updatedAt = now();
		return create(UpdateReceiptResponseSchema, { receipt: x });
	},
	async deleteReceipt(req) {
		db.receipts = db.receipts.filter((x) => x.id !== req.id);
		for (const t of db.transactions)
			if (t.receiptId === req.id) t.receiptId = undefined;
		return create(DeleteReceiptResponseSchema, {});
	},
	async retryParseReceipt(req) {
		const x = db.receipts.find((y) => y.id === req.id);
		if (x) {
			x.status = ReceiptStatus.PENDING;
			x.updatedAt = now();
		}
		return create(RetryParseReceiptResponseSchema, { receipt: x });
	},
});

export const connectionsClient = fake(ConnectionsService, {
	async listConnections() {
		return create(ListConnectionsResponseSchema, {
			connections: db.connections,
		});
	},
	async createConnection(req) {
		const c = create(ConnectionSchema, {
			id: nextId(),
			provider: req.provider,
			status: "active",
			createdAt: now(),
			syncIntervalMinutes: req.syncIntervalMinutes,
		});
		db.connections.push(c);
		return create(CreateConnectionResponseSchema, { id: c.id });
	},
	async deleteConnection(req) {
		db.connections = db.connections.filter((c) => c.id !== req.id);
		return create(DeleteConnectionResponseSchema, {});
	},
	async triggerSync(req) {
		const c = db.connections.find((x) => x.id === req.id);
		if (c) c.lastSynced = now();
		return create(TriggerSyncResponseSchema, {});
	},
	async setSyncInterval(req) {
		const c = db.connections.find((x) => x.id === req.id);
		if (c) c.syncIntervalMinutes = req.syncIntervalMinutes;
		return create(SetSyncIntervalResponseSchema, {});
	},
});
