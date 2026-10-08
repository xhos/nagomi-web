// RBC online banking "download transactions" CSV: one file can mix accounts, with the
// account number on every row. Amounts are signed, in whichever of CAD$ / USD$ is filled.

export interface RbcRow {
	accountType: string;
	accountNumber: string;
	// local calendar day as yyyy-mm-dd
	day: string;
	description: string;
	currency: "CAD" | "USD";
	// signed: negative is money out
	cents: number;
}

function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (c === '"') quoted = false;
			else cell += c;
		} else if (c === '"') quoted = true;
		else if (c === ",") {
			row.push(cell);
			cell = "";
		} else if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(cell);
			cell = "";
			if (row.some((x) => x.trim() !== "")) rows.push(row);
			row = [];
		} else cell += c;
	}
	row.push(cell);
	if (row.some((x) => x.trim() !== "")) rows.push(row);
	return rows;
}

const pad = (n: number) => String(n).padStart(2, "0");

// m/d/yyyy to yyyy-mm-dd, null when it isn't a real date
function parseDay(s: string): string | null {
	const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
	if (!m) return null;
	const [month, day, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
	const d = new Date(year, month - 1, day);
	if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
	return `${year}-${pad(month)}-${pad(day)}`;
}

function parseCents(s: string): number | null {
	const t = s.trim().replace(/[$,]/g, "");
	if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
	return Math.round(Number(t) * 100);
}

export interface RbcParse {
	rows: RbcRow[];
	// data rows that weren't a dated, non-zero amount on a named account
	skipped: number;
}

export function parseRbcCsv(text: string): RbcParse | null {
	const table = parseCsv(text.replace(/^﻿/, ""));
	const header = table[0]?.map((h) => h.trim());
	if (!header) return null;
	const col = (name: string) => header.indexOf(name);
	const [type, number, date, d1, d2, cad, usd] = [
		"Account Type",
		"Account Number",
		"Transaction Date",
		"Description 1",
		"Description 2",
		"CAD$",
		"USD$",
	].map(col);
	if ([type, number, date, d1, d2].some((i) => i < 0) || (cad < 0 && usd < 0))
		return null;

	const rows: RbcRow[] = [];
	let skipped = 0;
	for (const r of table.slice(1)) {
		const day = parseDay(r[date] ?? "");
		const inCad = cad >= 0 ? parseCents(r[cad] ?? "") : null;
		const inUsd = usd >= 0 ? parseCents(r[usd] ?? "") : null;
		const cents = inCad ?? inUsd;
		const accountNumber = (r[number] ?? "").trim();
		if (!day || cents === null || cents === 0 || !accountNumber) {
			skipped++;
			continue;
		}
		rows.push({
			accountType: (r[type] ?? "").trim(),
			accountNumber,
			day,
			description: [r[d1], r[d2]]
				.map((x) => (x ?? "").trim())
				.filter(Boolean)
				.join(" "),
			currency: inCad !== null ? "CAD" : "USD",
			cents,
		});
	}
	return { rows, skipped };
}

const digits = (s: string) => s.replace(/\D/g, "");

// RBC prints chequing as 05172-5163878 where statements may carry only the last seven
// digits, so an alias matches when one number ends with the other (at least four digits)
export function accountNumberMatches(csv: string, alias: string): boolean {
	const a = digits(csv).replace(/^0+/, "");
	const b = digits(alias).replace(/^0+/, "");
	if (a.length < 4 || b.length < 4) return false;
	return a === b || a.endsWith(b) || b.endsWith(a);
}

export const dayKey = (d: Date) =>
	`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const dayNumber = (day: string) => {
	const [y, m, d] = day.split("-").map(Number);
	return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

export interface ExistingTx {
	day: string;
	cents: number;
}

// How far a posted date may sit from the date a transaction was first recorded
// (an email or connector transaction carries the purchase day, the CSV the posting day).
const DATE_WINDOW = 1;

// Which rows are not yet in the account. Identical rows on one day are real (two
// e-transfers of the same size), so each existing transaction cancels out exactly one row
// rather than every row that looks like it. Exact days pair first, then neighbouring days.
export function splitNew<T extends { day: string; cents: number }>(
	rows: T[],
	existing: ExistingTx[],
): { fresh: T[]; duplicates: T[] } {
	const used = new Array<boolean>(existing.length).fill(false);
	const isDuplicate = new Array<boolean>(rows.length).fill(false);

	for (let window = 0; window <= DATE_WINDOW; window++) {
		rows.forEach((row, i) => {
			if (isDuplicate[i]) return;
			const at = dayNumber(row.day);
			let best = -1;
			existing.forEach((e, j) => {
				if (used[j] || e.cents !== row.cents) return;
				const dist = Math.abs(dayNumber(e.day) - at);
				if (dist === window) best = best < 0 ? j : best;
			});
			if (best >= 0) {
				used[best] = true;
				isDuplicate[i] = true;
			}
		});
	}

	return {
		fresh: rows.filter((_, i) => !isDuplicate[i]),
		duplicates: rows.filter((_, i) => isDuplicate[i]),
	};
}
