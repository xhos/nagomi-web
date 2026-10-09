import { create } from "@bufbuild/protobuf";
import { type Timestamp, TimestampSchema } from "@bufbuild/protobuf/wkt";
import { DateSchema, type Date as ProtoDate } from "@/gen/google/type/date_pb";
import { type Money, MoneySchema } from "@/gen/google/type/money_pb";
import { type Account, AccountSchema } from "@/gen/nagomi/v1/account_pb";
import { type Category, CategorySchema } from "@/gen/nagomi/v1/category_pb";
import {
	type Connection,
	ConnectionSchema,
} from "@/gen/nagomi/v1/connection_services_pb";
import {
	AccountType,
	TransactionDirection,
	TransactionSource,
	TransferMethod,
	TransferStatus,
} from "@/gen/nagomi/v1/enums_pb";
import {
	type Receipt,
	ReceiptSchema,
	ReceiptStatus,
} from "@/gen/nagomi/v1/receipt_pb";
import { type Rule, RuleSchema } from "@/gen/nagomi/v1/rule_pb";
import {
	type ParsedStatementLine,
	ParsedStatementLineSchema,
} from "@/gen/nagomi/v1/statement_parser_pb";
import {
	type Statement,
	StatementSchema,
	StatementStatus,
} from "@/gen/nagomi/v1/statement_pb";
import {
	type Transaction,
	TransactionSchema,
} from "@/gen/nagomi/v1/transaction_pb";

export const DEMO_USER = {
	id: "00000000-0000-4000-8000-000000000001",
	email: "demo@nagomi.app",
	name: "demo",
};

const CUR = "CAD";
const { DIRECTION_INCOMING: IN, DIRECTION_OUTGOING: OUT } =
	TransactionDirection;

// proto <-> js helpers

export const money = (cents: number, currencyCode = CUR): Money =>
	create(MoneySchema, {
		currencyCode,
		units: BigInt(Math.trunc(cents / 100)),
		nanos: Math.trunc(cents % 100) * 1e7,
	});
export const cents = (m?: Money) =>
	m ? Number(m.units) * 100 + Math.round(m.nanos / 1e7) : 0;
export const ts = (d: Date): Timestamp =>
	create(TimestampSchema, { seconds: BigInt(Math.floor(d.getTime() / 1000)) });
export const tsDate = (t?: Timestamp) =>
	new Date(Number(t?.seconds ?? BigInt(0)) * 1000);
export const pdate = (d: Date): ProtoDate =>
	create(DateSchema, {
		year: d.getFullYear(),
		month: d.getMonth() + 1,
		day: d.getDate(),
	});
export const fromPdate = (d: ProtoDate) => new Date(d.year, d.month - 1, d.day);

// mulberry32, so the dataset is identical on every load
function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

let idCounter = BigInt(1);
export const nextId = () => idCounter++;

export const db = {
	accounts: [] as Account[],
	categories: [] as Category[],
	transactions: [] as Transaction[],
	rules: [] as Rule[],
	receipts: [] as Receipt[],
	connections: [] as Connection[],
	statements: [] as Statement[],
	transfers: [] as DemoTransfer[],
};

// core's transfers table: two transactions that move money between own accounts
export interface DemoTransfer {
	id: bigint;
	outId: bigint;
	inId: bigint;
	status: TransferStatus;
	method: TransferMethod;
}

export function addTransfer(
	out: Transaction,
	into: Transaction,
	status = TransferStatus.LINKED,
	method = TransferMethod.MATCHED,
) {
	db.transfers.push({
		id: nextId(),
		outId: out.id,
		inId: into.id,
		status,
		method,
	});
}

// what core keeps next to a statement row: the file and its parsed lines
export const statementFiles = new Map<
	bigint,
	{ hash: string; pdf: Uint8Array; lines: ParsedStatementLine[] }
>();

// core's line ids: stable per line; identical lines are told apart by the order they appear in
export function lineExternalIds(lines: ParsedStatementLine[]) {
	const seen = new Map<string, number>();
	return lines.map((l) => {
		const d = l.date;
		const key = `${d?.year}-${d?.month}-${d?.day}|${l.amountCents}|${l.direction}|${l.description}`;
		const occurrence = seen.get(key) ?? 0;
		seen.set(key, occurrence + 1);
		return `stmt:${key}|${occurrence}`;
	});
}

// seeded email transactions a demo statement upload changes
export const DEMO_TIPPED_CENTS = 14_200;
export const DEMO_HOLD = "FAIRMONT ROYAL YORK HOLD";

// transaction id -> the statement that confirmed it; core's transactions.statement_id
export const statementLinks = new Map<bigint, bigint>();

// a one-page pdf with a few lines of text, so "view statement" opens something real
export function demoPdf(lines: string[]): Uint8Array {
	const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
	const text = lines
		.map(
			(l, i) =>
				`BT /F1 ${i ? 11 : 16} Tf 56 ${740 - i * 22} Td (${esc(l)}) Tj ET`,
		)
		.join("\n");
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		`<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	];
	let out = "%PDF-1.4\n";
	const offsets = objects.map((body, i) => {
		const at = out.length;
		out += `${i + 1} 0 obj\n${body}\nendobj\n`;
		return at;
	});
	const xref = out.length;
	out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
	out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return new TextEncoder().encode(out);
}

// recompute balanceAfter for one account from its anchor, like core's SyncAccountBalances
export function syncBalances(accountId: bigint) {
	const acc = db.accounts.find((a) => a.id === accountId);
	if (!acc) return;
	const txs = db.transactions
		.filter((t) => t.accountId === accountId)
		.sort(
			(a, b) =>
				Number(a.txDate?.seconds ?? BigInt(0)) -
					Number(b.txDate?.seconds ?? BigInt(0)) || Number(a.id - b.id),
		);
	let bal = cents(acc.anchorBalance);
	for (const t of txs) {
		if (!t.forgiven) {
			const amt = cents(t.txAmount);
			bal += t.direction === IN ? amt : -amt;
		}
		t.balanceAfter = money(bal, acc.mainCurrency);
	}
	acc.balance = money(bal, acc.mainCurrency);
}

export function categoryBySlug(slug: string) {
	return db.categories.find((c) => c.slug === slug);
}

// generator

interface TxSpec {
	account: Account;
	date: Date;
	amount: number;
	direction: TransactionDirection;
	merchant?: string;
	description?: string;
	category?: string;
	notes?: string;
	foreign?: { cents: number; cur: string; rate: number };
}

function addTx(s: TxSpec): Transaction {
	const cat = s.category ? categoryBySlug(s.category) : undefined;
	const t = create(TransactionSchema, {
		id: nextId(),
		accountId: s.account.id,
		txDate: ts(s.date),
		txAmount: money(s.amount, s.account.mainCurrency),
		direction: s.direction,
		merchant: s.merchant,
		description: s.description ?? s.merchant,
		categoryId: cat?.id,
		userNotes: s.notes,
		foreignAmount: s.foreign
			? money(s.foreign.cents, s.foreign.cur)
			: undefined,
		exchangeRate: s.foreign?.rate,
		createdAt: ts(s.date),
		updatedAt: ts(s.date),
	});
	db.transactions.push(t);
	return t;
}

function addAccount(
	name: string,
	bank: string,
	type: AccountType,
	anchor: number,
	anchorDate: Date,
	color: string,
	friendlyName?: string,
	currency = CUR,
) {
	const a = create(AccountSchema, {
		id: nextId(),
		ownerId: DEMO_USER.id,
		name,
		bank,
		type,
		friendlyName,
		mainCurrency: currency,
		color,
		anchorBalance: money(anchor, currency),
		anchorDate: ts(anchorDate),
		createdAt: ts(anchorDate),
		updatedAt: ts(anchorDate),
	});
	db.accounts.push(a);
	return a;
}

const CATEGORIES: [string, string][] = [
	["income.salary", "#22c55e"],
	["income.other", "#86efac"],
	["housing.rent", "#f97316"],
	["housing.utilities", "#fb923c"],
	["food.groceries", "#3b82f6"],
	["food.dining", "#60a5fa"],
	["food.coffee", "#93c5fd"],
	["transport.transit", "#a855f7"],
	["transport.rideshare", "#c084fc"],
	["shopping", "#ec4899"],
	["subscriptions", "#14b8a6"],
	["entertainment", "#eab308"],
	["health", "#ef4444"],
	["travel", "#06b6d4"],
	["transfers", "#64748b"],
	["investing", "#0ea5e9"],
];

const PANTRY: [string, number, number][] = [
	["Bananas", 1.2, 189],
	["Oat milk", 2, 449],
	["Sourdough", 1, 599],
	["Eggs 12pk", 1, 489],
	["Greek yogurt", 3, 349],
	["Chicken thighs", 1, 1247],
	["Avocados", 4, 149],
	["Basmati rice 5kg", 1, 1599],
	["Olive oil", 1, 1299],
	["Cherry tomatoes", 2, 399],
	["Sparkling water 12pk", 1, 699],
	["Dark chocolate", 2, 429],
	["Frozen dumplings", 1, 899],
];

const secsBefore = (d: Date) => Math.floor(d.getTime() / 1000);
const secsOf = (t: Transaction) => Number(t.txDate?.seconds ?? BigInt(0));
const at = (d: Date, h: number, m = 0) => {
	const x = new Date(d);
	x.setHours(h, m, 0, 0);
	return x;
};
const addDays = (d: Date, n: number) => {
	const x = new Date(d);
	x.setDate(x.getDate() + n);
	return x;
};

function seed() {
	const rand = rng(20260914);
	const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
	const between = (lo: number, hi: number) =>
		Math.round(lo + rand() * (hi - lo));
	const chance = (p: number) => rand() < p;

	const today = new Date();
	today.setHours(12, 0, 0, 0);
	const start = addDays(today, -365);

	for (const [slug, color] of CATEGORIES)
		db.categories.push(create(CategorySchema, { id: nextId(), slug, color }));

	const chequing = addAccount(
		"TD Every Day Chequing",
		"TD",
		AccountType.ACCOUNT_CHEQUING,
		318_240,
		start,
		"#10b981",
		"chequing",
	);
	const savings = addAccount(
		"Tangerine Savings",
		"Tangerine",
		AccountType.ACCOUNT_SAVINGS,
		1_240_000,
		start,
		"#f97316",
		"savings",
	);
	const credit = addAccount(
		"Amex Cobalt",
		"American Express",
		AccountType.ACCOUNT_CREDIT_CARD,
		-42_310,
		start,
		"#6366f1",
		"cobalt",
	);
	const tfsa = addAccount(
		"Wealthsimple TFSA",
		"Wealthsimple",
		AccountType.ACCOUNT_INVESTMENT,
		1_860_000,
		start,
		"#0ea5e9",
		"tfsa",
	);
	const wiseUsd = addAccount(
		"Wise USD",
		"Wise",
		AccountType.ACCOUNT_SAVINGS,
		250_000,
		start,
		"#64748b",
		"US dollars",
		"USD",
	);
	const friends = ["alex", "sam", "jordan"].map((n) =>
		addAccount(n, "friend", AccountType.ACCOUNT_FRIEND, 0, start, "#3b82f6"),
	);

	// biweekly salary
	for (let d = addDays(start, 4); d <= today; d = addDays(d, 14)) {
		addTx({
			account: chequing,
			date: at(d, 6, 2),
			amount: 284_615,
			direction: IN,
			merchant: "Shopify Inc",
			description: "PAYROLL DEPOSIT SHOPIFY INC",
			category: "income.salary",
		});
	}

	const groceries = ["Loblaws", "Metro", "No Frills", "Costco", "Farm Boy"];
	const coffee = ["Pilot Coffee", "Tim Hortons", "Starbucks", "Balzac's"];
	const dining = [
		"Pai Northern Thai",
		"Sugo",
		"Kinka Izakaya",
		"Seven Lives",
		"Bar Isabel",
		"Uber Eats",
		"Chipotle",
	];
	const shops = [
		"Amazon.ca",
		"Uniqlo",
		"MEC",
		"Canadian Tire",
		"IKEA",
		"Indigo",
		"Apple Store",
	];
	const fun = ["Cineplex", "Steam", "Ticketmaster", "Bandcamp", "Nintendo"];

	// day-to-day spending on the credit card
	for (let d = new Date(start); d <= today; d = addDays(d, 1)) {
		const dow = d.getDay();
		if (chance(0.55))
			addTx({
				account: credit,
				date: at(d, between(7, 10), between(0, 59)),
				amount: between(380, 780),
				direction: OUT,
				merchant: pick(coffee),
				category: chance(0.94) ? "food.coffee" : undefined,
			});
		if (chance(dow === 6 ? 0.8 : 0.3))
			addTx({
				account: credit,
				date: at(d, between(11, 19), between(0, 59)),
				amount: between(2_400, 16_500),
				direction: OUT,
				merchant: pick(groceries),
				category: chance(0.95) ? "food.groceries" : undefined,
			});
		if (chance(dow >= 5 ? 0.55 : 0.25))
			addTx({
				account: credit,
				date: at(d, between(12, 21), between(0, 59)),
				amount: between(1_400, 9_800),
				direction: OUT,
				merchant: pick(dining),
				category: chance(0.9) ? "food.dining" : undefined,
			});
		if (dow >= 1 && dow <= 5 && chance(0.7))
			addTx({
				account: credit,
				date: at(d, 8, between(5, 40)),
				amount: 336,
				direction: OUT,
				merchant: "PRESTO",
				description: "PRESTO FARE",
				category: "transport.transit",
			});
		if (chance(0.08))
			addTx({
				account: credit,
				date: at(d, between(21, 23), between(0, 59)),
				amount: between(1_100, 3_900),
				direction: OUT,
				merchant: "Uber",
				category: "transport.rideshare",
			});
		if (chance(0.12))
			addTx({
				account: credit,
				date: at(d, between(10, 20), between(0, 59)),
				amount: between(1_800, 24_000),
				direction: OUT,
				merchant: pick(shops),
				category: chance(0.85) ? "shopping" : undefined,
			});
		if (chance(0.07))
			addTx({
				account: credit,
				date: at(d, between(18, 22), between(0, 59)),
				amount: between(900, 8_900),
				direction: OUT,
				merchant: pick(fun),
				category: "entertainment",
			});
		if (chance(0.03))
			addTx({
				account: credit,
				date: at(d, between(9, 17), between(0, 59)),
				amount: between(1_500, 12_000),
				direction: OUT,
				merchant: pick(["Shoppers Drug Mart", "Rexall", "Dr. Patel Dental"]),
				category: "health",
			});
		if (chance(0.02))
			addTx({
				account: chequing,
				date: at(d, between(10, 16), between(0, 59)),
				amount: between(4_000, 20_000),
				direction: OUT,
				merchant: "Interac e-Transfer",
				description: `INTERAC E-TRANSFER SENT ${pick(["MOM", "LANDLORD", "MARKETPLACE"])}`,
			});
	}

	// one trip, in USD
	const trip = addDays(start, 200);
	for (const [off, m, usd, cat] of [
		[0, "Air Canada", 41_800, "travel"],
		[1, "The Hoxton Williamsburg", 89_200, "travel"],
		[2, "Joe's Pizza", 1_450, "food.dining"],
		[2, "MoMA", 3_000, "entertainment"],
		[3, "Blue Bottle", 640, "food.coffee"],
		[3, "MTA", 290, "transport.transit"],
		[4, "Katz's Delicatessen", 5_100, "food.dining"],
	] as const)
		addTx({
			account: credit,
			date: at(addDays(trip, off), between(9, 21)),
			amount: Math.round(usd * 1.37),
			direction: OUT,
			merchant: m,
			category: cat,
			foreign: { cents: usd, cur: "USD", rate: 1.37 },
			notes: off === 0 ? "nyc long weekend" : undefined,
		});

	// monthly fixed costs + transfers
	for (let m = new Date(start); m <= today; m.setMonth(m.getMonth() + 1)) {
		const first = new Date(m.getFullYear(), m.getMonth(), 1);
		if (first < start) continue;
		const on = (day: number, h = 9) =>
			at(new Date(first.getFullYear(), first.getMonth(), day), h);
		if (on(1) <= today)
			addTx({
				account: chequing,
				date: on(1, 0),
				amount: 195_000,
				direction: OUT,
				merchant: "Minto Properties",
				description: "PREAUTHORIZED DEBIT MINTO",
				category: "housing.rent",
			});
		// transfers core pairs on its own, so they carry no category
		if (on(3) <= today)
			addTransfer(
				addTx({
					account: chequing,
					date: on(3),
					amount: 50_000,
					direction: OUT,
					description: "TRANSFER TO SAVINGS",
				}),
				addTx({
					account: savings,
					date: on(3),
					amount: 50_000,
					direction: IN,
					description: "TRANSFER FROM CHEQUING",
				}),
			);
		if (on(5) <= today)
			addTransfer(
				addTx({
					account: chequing,
					date: on(5),
					amount: 40_000,
					direction: OUT,
					merchant: "Wealthsimple",
					description: "WSII CONTRIBUTION",
					category: "investing",
				}),
				addTx({
					account: tfsa,
					date: on(5),
					amount: 40_000,
					direction: IN,
					merchant: "Wealthsimple",
					description: "CONTRIBUTION",
					category: "investing",
				}),
			);
		if (on(12) <= today)
			addTx({
				account: credit,
				date: on(12, 7),
				amount: 8_945,
				direction: OUT,
				merchant: "Rogers",
				description: "ROGERS WIRELESS",
				category: "housing.utilities",
			});
		if (on(15) <= today)
			addTx({
				account: chequing,
				date: on(15, 8),
				amount: 7_800,
				direction: OUT,
				merchant: "Beanfield",
				description: "BEANFIELD INTERNET",
				category: "housing.utilities",
			});
		if (on(18) <= today)
			addTx({
				account: chequing,
				date: on(18, 8),
				amount: between(6_000, 11_000),
				direction: OUT,
				merchant: "Toronto Hydro",
				description: "TORONTO HYDRO",
				category: "housing.utilities",
			});
		for (const [day, name, amt] of [
			[8, "Netflix", 2_099],
			[9, "Spotify", 1_299],
			[20, "iCloud", 399],
			[22, "GoodLife Fitness", 4_999],
		] as const)
			if (on(day) <= today)
				addTx({
					account: credit,
					date: on(day, 3),
					amount: amt,
					direction: OUT,
					merchant: name,
					category: "subscriptions",
				});
		// pay the statement in full: whatever the card owes as of the 26th
		const due = secsBefore(on(26, 10));
		const pay = -(
			cents(credit.anchorBalance) +
			db.transactions
				.filter((t) => t.accountId === credit.id && secsOf(t) < due)
				.reduce(
					(n, t) => n + (t.direction === IN ? 1 : -1) * cents(t.txAmount),
					0,
				)
		);
		if (on(26) <= today && pay > 0)
			addTransfer(
				addTx({
					account: chequing,
					date: on(26, 10),
					amount: pay,
					direction: OUT,
					description: "AMEX PAYMENT",
				}),
				addTx({
					account: credit,
					date: on(26, 10),
					amount: pay,
					direction: IN,
					description: "PAYMENT RECEIVED - THANK YOU",
				}),
			);
		// tfsa drift + occasional dividend
		if (on(28) <= today) {
			const drift = between(-45_000, 70_000);
			addTx({
				account: tfsa,
				date: on(28, 16),
				amount: Math.abs(drift),
				direction: drift >= 0 ? IN : OUT,
				merchant: "Wealthsimple",
				description: "MARKET VALUE CHANGE",
				category: "investing",
			});
		}
		if (chance(0.4) && on(21) <= today)
			addTx({
				account: tfsa,
				date: on(21, 16),
				amount: between(2_000, 9_000),
				direction: IN,
				merchant: "VEQT",
				description: "DIVIDEND VEQT",
				category: "income.other",
			});
	}

	// splits with friends
	const dinners = db.transactions.filter(
		(t) =>
			t.categoryId === categoryBySlug("food.dining")?.id &&
			cents(t.txAmount) > 6_000,
	);
	for (const src of dinners.slice(-6)) {
		const who = friends.slice(0, chance(0.5) ? 1 : 2);
		const share = Math.round(cents(src.txAmount) / (who.length + 1));
		for (const f of who) {
			const s = addTx({
				account: f,
				date: tsDate(src.txDate),
				amount: share,
				direction: IN,
				merchant: src.merchant,
				description: src.description,
				category: "food.dining",
			});
			s.splitFromId = src.id;
		}
	}
	// some settled up, one forgiven
	const alexOwes = db.transactions.filter(
		(t) => t.accountId === friends[0].id && t.direction === IN,
	);
	if (alexOwes.length > 2) {
		const paid = alexOwes
			.slice(0, 2)
			.reduce((n, t) => n + cents(t.txAmount), 0);
		addTx({
			account: friends[0],
			date: addDays(tsDate(alexOwes[1].txDate), 3),
			amount: paid,
			direction: OUT,
			merchant: "Interac e-Transfer",
			description: "settled up",
		});
		addTx({
			account: chequing,
			date: addDays(tsDate(alexOwes[1].txDate), 3),
			amount: paid,
			direction: IN,
			merchant: "Interac e-Transfer",
			description: "INTERAC E-TRANSFER RECEIVED ALEX",
			category: "income.other",
		});
	}
	// a conversion, paired by the importer's reference
	addTransfer(
		addTx({
			account: chequing,
			date: at(addDays(today, -12), 14, 5),
			amount: 68_500,
			direction: OUT,
			description: "WISE PAYMENTS LTD",
		}),
		addTx({
			account: wiseUsd,
			date: at(addDays(today, -12), 14, 7),
			amount: 50_000,
			direction: IN,
			description: "Converted 685.00 CAD to 500.00 USD",
		}),
		TransferStatus.LINKED,
		TransferMethod.REFERENCE,
	);
	// a transfer that loses a fee on the way
	addTransfer(
		addTx({
			account: chequing,
			date: at(addDays(today, -9), 20, 41),
			amount: 20_150,
			direction: OUT,
			description: "INTERAC E-TRANSFER TO TANGERINE",
		}),
		addTx({
			account: savings,
			date: at(addDays(today, -8), 9, 2),
			amount: 20_000,
			direction: IN,
			description: "INTERAC E-TRANSFER DEPOSIT",
		}),
	);

	// matching amounts with nothing else in common: core only suggests these
	addTransfer(
		addTx({
			account: chequing,
			date: at(addDays(today, -6), 18, 12),
			amount: 30_000,
			direction: OUT,
			description: "E-TRANSFER SENT",
		}),
		addTx({
			account: savings,
			date: at(addDays(today, -5), 9, 30),
			amount: 30_000,
			direction: IN,
			description: "DEPOSIT",
		}),
		TransferStatus.SUGGESTED,
	);

	const samOwes = db.transactions.find(
		(t) => t.accountId === friends[1].id && t.direction === IN,
	);
	if (samOwes) samOwes.forgiven = true;

	for (const a of db.accounts) syncBalances(a.id);

	// rules
	const rule = (
		name: string,
		category: string,
		field: string,
		operator: string,
		v: string | string[],
		priority: number,
		times: number,
	) =>
		db.rules.push(
			create(RuleSchema, {
				ruleId: crypto.randomUUID(),
				userId: DEMO_USER.id,
				ruleName: name,
				categoryId: categoryBySlug(category)?.id,
				conditions: {
					logic: "AND",
					conditions: [
						{
							field,
							operator,
							...(Array.isArray(v) ? { values: v } : { value: v }),
							case_sensitive: false,
						},
					],
				},
				isActive: true,
				priorityOrder: priority,
				ruleSource: "user_created",
				timesApplied: times,
				createdAt: ts(addDays(start, 2)),
				updatedAt: ts(addDays(start, 2)),
				lastAppliedAt: ts(addDays(today, -1)),
			}),
		);
	rule(
		"groceries",
		"food.groceries",
		"merchant",
		"contains_any",
		groceries,
		1,
		118,
	);
	rule("coffee", "food.coffee", "merchant", "contains_any", coffee, 2, 201);
	rule("presto", "transport.transit", "merchant", "equals", "PRESTO", 3, 182);
	rule("rent", "housing.rent", "tx_desc", "contains", "MINTO", 4, 12);
	rule("payroll", "income.salary", "tx_desc", "starts_with", "PAYROLL", 5, 26);
	db.rules.push(
		create(RuleSchema, {
			ruleId: crypto.randomUUID(),
			userId: DEMO_USER.id,
			ruleName: "big amazon orders",
			categoryId: categoryBySlug("shopping")?.id,
			conditions: {
				logic: "AND",
				conditions: [
					{
						field: "merchant",
						operator: "contains",
						value: "amazon",
						case_sensitive: false,
					},
					{ field: "amount", operator: "greater_than", value: 100 },
				],
			},
			isActive: false,
			priorityOrder: 6,
			ruleSource: "ai_suggested",
			timesApplied: 0,
			createdAt: ts(addDays(today, -9)),
			updatedAt: ts(addDays(today, -9)),
		}),
	);

	// receipts: a few linked, a couple parsed but unlinked, one pending, one failed
	const groceryTxs = db.transactions
		.filter(
			(t) => groceries.includes(t.merchant ?? "") && cents(t.txAmount) > 5_000,
		)
		.slice(-5);
	const items = (names: [string, number, number][]) =>
		names.map(([raw, qty, price], i) => ({
			id: nextId(),
			rawName: raw.toUpperCase(),
			name: raw,
			quantity: qty,
			unitPrice: money(price),
			sortOrder: i,
		}));
	const receipt = (
		status: ReceiptStatus,
		date: Date,
		merchant?: string,
		total?: number,
		tx?: Transaction,
	) => {
		const sub = total ? Math.round(total / 1.13) : undefined;
		db.receipts.push(
			create(ReceiptSchema, {
				id: nextId(),
				userId: DEMO_USER.id,
				transactionId: tx?.id,
				imagePath: `receipts/${DEMO_USER.id}/${nextId()}.jpg`,
				merchant,
				receiptDate: pdate(date),
				bestDate: pdate(date),
				currency: total ? CUR : undefined,
				subtotal: sub ? money(sub) : undefined,
				tax: sub && total ? money(total - sub) : undefined,
				total: total ? money(total) : undefined,
				confidence:
					status === ReceiptStatus.FAILED ? undefined : 0.82 + rand() * 0.17,
				status,
				items:
					status === ReceiptStatus.FAILED || status === ReceiptStatus.PENDING
						? []
						: items(
								[...PANTRY].sort(() => rand() - 0.5).slice(0, between(4, 7)),
							),
				transactionMerchant: tx?.merchant,
				transactionAmount: tx?.txAmount,
				imageTakenAt: ts(date),
				createdAt: ts(date),
				updatedAt: ts(date),
				source: "web",
			}),
		);
		if (tx) tx.receiptId = db.receipts[db.receipts.length - 1].id;
	};
	for (const t of groceryTxs.slice(0, 3))
		receipt(
			ReceiptStatus.LINKED,
			tsDate(t.txDate),
			t.merchant,
			cents(t.txAmount),
			t,
		);
	for (const t of groceryTxs.slice(3))
		receipt(
			ReceiptStatus.PARSED,
			tsDate(t.txDate),
			t.merchant,
			cents(t.txAmount),
		);
	receipt(ReceiptStatus.PENDING, addDays(today, -1));
	receipt(ReceiptStatus.FAILED, addDays(today, -4));

	db.connections.push(
		create(ConnectionSchema, {
			id: nextId(),
			provider: "wise",
			status: "active",
			lastSynced: ts(new Date(today.getTime() - 2 * 3600e3)),
			createdAt: ts(addDays(start, 30)),
			syncIntervalMinutes: 360,
			nextRunAt: ts(new Date(today.getTime() + 4 * 3600e3)),
		}),
		create(ConnectionSchema, {
			id: nextId(),
			provider: "snaptrade",
			status: "broken",
			lastSynced: ts(addDays(today, -6)),
			createdAt: ts(addDays(start, 90)),
		}),
	);

	// monthly statements for the chequing account, one month missing. its
	// transactions arrive by email and each statement confirms its month's
	chequing.aliases.push("5163878");
	chequing.statementDriven = true;
	// in the missing month: a dinner whose email shows the bill before the tip, and a
	// hotel hold that was released and never posts. a demo upload of that month's
	// statement corrects the one and drops the other (see linesFromTransactions)
	const missing = new Date(today.getFullYear(), today.getMonth() - 4, 1);
	addTx({
		account: chequing,
		date: addDays(missing, 7),
		amount: DEMO_TIPPED_CENTS,
		direction: OUT,
		merchant: "Bar Isabel",
		description: "BAR ISABEL TORONTO",
		category: "food.dining",
	});
	addTx({
		account: chequing,
		date: addDays(missing, 9),
		amount: 30_000,
		direction: OUT,
		merchant: "Fairmont Royal York",
		description: DEMO_HOLD,
		category: "travel",
	});
	syncBalances(chequing.id);
	for (const t of db.transactions)
		if (t.accountId === chequing.id) t.source = TransactionSource.EMAIL;
	for (let back = 11; back >= 1; back--) {
		if (back === 4) continue;
		const from = new Date(today.getFullYear(), today.getMonth() - back, 1);
		const to = new Date(today.getFullYear(), today.getMonth() - back + 1, 0);
		if (from < start) continue;
		const inPeriod = db.transactions
			.filter((t) => {
				const d = tsDate(t.txDate);
				return (
					t.accountId === chequing.id &&
					!t.splitFromId &&
					d >= from &&
					d < addDays(to, 1)
				);
			})
			.sort(
				(a, b) =>
					Number(a.txDate?.seconds ?? 0) - Number(b.txDate?.seconds ?? 0) ||
					Number(a.id - b.id),
			);
		const lines = inPeriod.map((t) =>
			create(ParsedStatementLineSchema, {
				date: pdate(tsDate(t.txDate)),
				postingDate: pdate(tsDate(t.txDate)),
				amountCents: BigInt(cents(t.txAmount)),
				direction: t.direction,
				description: t.description ?? "",
			}),
		);
		const id = nextId();
		const ids = lineExternalIds(lines);
		inPeriod.forEach((t, i) => {
			t.externalId = ids[i];
			t.source = TransactionSource.STATEMENT;
			statementLinks.set(t.id, id);
		});
		const before = db.transactions
			.filter(
				(t) =>
					t.accountId === chequing.id &&
					tsDate(t.txDate) < from &&
					t.balanceAfter,
			)
			.at(-1);
		const opening = before
			? cents(before.balanceAfter)
			: cents(chequing.anchorBalance);
		const net = lines.reduce(
			(sum, l) => sum + (l.direction === IN ? 1 : -1) * Number(l.amountCents),
			0,
		);
		// one statement the parser misread, so a "doesn't add up" month shows
		const misread = back === 7 ? 1_000 : 0;
		const month = from.toLocaleString("en", { month: "long", year: "numeric" });
		db.statements.push(
			create(StatementSchema, {
				id,
				status: StatementStatus.IMPORTED,
				accountId: chequing.id,
				accountName: chequing.friendlyName ?? chequing.name,
				fileName: `td-chequing-${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}.pdf`,
				parser: "td-chequing",
				bank: "TD",
				accountType: AccountType.ACCOUNT_CHEQUING,
				accountNumber: "5163878",
				periodStart: pdate(from),
				periodEnd: pdate(to),
				currency: CUR,
				openingBalanceCents: BigInt(opening),
				closingBalanceCents: BigInt(opening + net + misread),
				balanceOk: misread === 0,
				lineCount: lines.length,
				createdAt: ts(addDays(to, 3)),
				importedAt: ts(addDays(to, 3)),
			}),
		);
		statementFiles.set(id, {
			hash: `seed-${id}`,
			pdf: demoPdf([
				"TD Every Day Chequing Account",
				`Statement for ${month}`,
				"Account 5163878",
				`${inPeriod.length} transactions`,
			]),
			lines,
		});
	}
}

seed();
