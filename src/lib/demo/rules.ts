// core's rule suggestions (nagomi-core internal/service/rule_suggestions.go) and a
// string-only slice of its rule evaluation, ported so the demo suggests and applies
// rules the way core does. keep suggestRules in step with core's.
import { create, type JsonObject } from "@bufbuild/protobuf";
import type { Rule } from "@/gen/nagomi/v1/rule_pb";
import {
	type RuleSuggestion,
	RuleSuggestionSchema,
} from "@/gen/nagomi/v1/rule_services_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";

const DEFAULT_LIMIT = 50;
const MIN_MATCHES = 3;
const MIN_PATTERN_LEN = 3;
const MAX_EXAMPLES = 5;

interface DescStat {
	desc: string;
	lower: string;
	count: number;
	last: bigint;
}

// leading words up to the first one with a digit, usually a store number or reference
export function descriptionPattern(desc: string): string {
	const fields = desc.split(/\s+/).filter(Boolean);
	if (!fields.length) return "";
	let end = fields.findIndex((f, i) => i > 0 && /\d/.test(f));
	if (end < 0) end = fields.length;
	let stop = 0;
	for (const f of fields.slice(0, end)) stop = desc.indexOf(f, stop) + f.length;
	// keep a processor's star, "AMAZON*" is narrower than "AMAZON"
	const chars = [...desc.slice(0, stop)];
	const trim = (ch: string) => ch !== "*" && /[\s\p{P}]/u.test(ch);
	while (chars.length && trim(chars[0])) chars.shift();
	while (chars.length && trim(chars[chars.length - 1])) chars.pop();
	return chars.join("");
}

export function suggestRules(
	uncategorized: Transaction[],
	categorized: Transaction[],
	limit = DEFAULT_LIMIT,
): RuleSuggestion[] {
	const byDesc = new Map<string, DescStat>();
	for (const t of uncategorized) {
		const desc = t.description ?? "";
		if (!desc.trim() || t.categoryManuallySet) continue;
		const s = byDesc.get(desc) ?? {
			desc,
			lower: desc.toLowerCase(),
			count: 0,
			last: BigInt(0),
		};
		s.count++;
		const secs = t.txDate?.seconds ?? BigInt(0);
		if (secs > s.last) s.last = secs;
		byDesc.set(desc, s);
	}
	const descs = [...byDesc.values()].sort(
		(a, b) =>
			b.count - a.count || (a.desc < b.desc ? -1 : a.desc > b.desc ? 1 : 0),
	);
	const cats = categorized
		.filter((t) => t.description && t.categoryId !== undefined)
		.map((t) => ({
			lower: (t.description ?? "").toLowerCase(),
			categoryId: t.categoryId as bigint,
		}));

	const keys: string[] = [];
	const keyCount = new Map<string, number>();
	const candidates = new Map<
		string,
		{ display: string; lower: string; matches: number[] }
	>();
	descs.forEach((d, i) => {
		const p = descriptionPattern(d.desc);
		keys[i] = "";
		if (p.length < MIN_PATTERN_LEN) return;
		const lp = p.toLowerCase();
		keys[i] = lp;
		keyCount.set(lp, (keyCount.get(lp) ?? 0) + d.count);
		if (!candidates.has(lp))
			candidates.set(lp, { display: p, lower: lp, matches: [] });
	});
	for (const c of candidates.values())
		descs.forEach((d, i) => {
			const k = keys[i];
			if (!d.lower.startsWith(c.lower)) return;
			if (k === c.lower || (keyCount.get(k) ?? 0) < MIN_MATCHES)
				c.matches.push(i);
		});

	const covered = new Array<boolean>(descs.length).fill(false);
	const remaining = (c: { matches: number[] }) =>
		c.matches.reduce((n, i) => (covered[i] ? n : n + descs[i].count), 0);

	const out: RuleSuggestion[] = [];
	while (out.length < limit) {
		let best: { display: string; lower: string; matches: number[] } | null =
			null;
		let bestN = 0;
		for (const c of candidates.values()) {
			const n = remaining(c);
			if (
				n > bestN ||
				(n === bestN && best && c.lower.length > best.lower.length)
			) {
				best = c;
				bestN = n;
			}
		}
		if (!best || bestN < MIN_MATCHES) break;

		const examples: string[] = [];
		let last = BigInt(0);
		for (const i of best.matches) {
			if (covered[i]) continue;
			covered[i] = true;
			if (examples.length < MAX_EXAMPLES) examples.push(descs[i].desc);
			if (descs[i].last > last) last = descs[i].last;
		}

		const counts = new Map<bigint, number>();
		let total = 0;
		for (const c of cats) {
			if (!c.lower.startsWith(best.lower)) continue;
			counts.set(c.categoryId, (counts.get(c.categoryId) ?? 0) + 1);
			total++;
		}
		let categoryId: bigint | undefined;
		let top = 0;
		for (const [id, n] of counts)
			if (n > top || (n === top && categoryId !== undefined && id < categoryId))
				[categoryId, top] = [id, n];

		out.push(
			create(RuleSuggestionSchema, {
				pattern: best.display,
				transactionCount: BigInt(bestN),
				examples,
				categoryId: top * 2 > total ? categoryId : undefined,
				lastSeen: last ? { seconds: last, nanos: 0 } : undefined,
			}),
		);
	}
	return out;
}

interface StringCondition {
	field: string;
	operator: string;
	value?: string;
	values?: string[];
	case_sensitive?: boolean;
}

function fieldValue(t: Transaction, field: string) {
	if (field === "tx_desc") return t.description;
	if (field === "merchant") return t.merchant;
	if (field === "currency") return t.txAmount?.currencyCode;
	return undefined;
}

// the demo only evaluates string conditions; anything else never matches
function conditionMatches(t: Transaction, c: StringCondition) {
	const raw = fieldValue(t, c.field);
	if (raw === undefined) return false;
	const fold = (s: string) => (c.case_sensitive ? s : s.toLowerCase());
	const v = fold(raw);
	const want = fold(c.value ?? "");
	switch (c.operator) {
		case "equals":
			return v === want;
		case "not_equals":
			return v !== want;
		case "contains":
			return v.includes(want);
		case "not_contains":
			return !v.includes(want);
		case "starts_with":
			return v.startsWith(want);
		case "ends_with":
			return v.endsWith(want);
		case "contains_any":
			return (c.values ?? []).some((x) => v.includes(fold(x)));
		default:
			return false;
	}
}

function ruleMatches(t: Transaction, conditions?: JsonObject) {
	const logic = conditions?.logic;
	const list = (conditions?.conditions ?? []) as unknown as StringCondition[];
	if (!list.length) return false;
	return logic === "OR"
		? list.some((c) => conditionMatches(t, c))
		: list.every((c) => conditionMatches(t, c));
}

// like core's ApplyToExisting: the first active rule to match wins, manual edits stay
export function applyRules(transactions: Transaction[], rules: Rule[]) {
	const active = rules
		.filter((r) => r.isActive)
		.sort((a, b) => a.priorityOrder - b.priorityOrder);
	for (const t of transactions) {
		let categoryId: bigint | undefined;
		let merchant: string | undefined;
		for (const r of active) {
			if (!ruleMatches(t, r.conditions)) continue;
			categoryId ??= r.categoryId;
			merchant ??= r.merchant;
			if (categoryId !== undefined && merchant !== undefined) break;
		}
		if (categoryId !== undefined && !t.categoryManuallySet)
			t.categoryId = categoryId;
		if (merchant !== undefined && !t.merchantManuallySet) t.merchant = merchant;
	}
}
