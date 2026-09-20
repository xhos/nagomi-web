import type { Cursor } from "@/gen/nagomi/v1/common_pb";

// A repeated cursor must fail visibly instead of hanging or returning partial totals.
export async function collectPages<T>(
	fetchPage: (cursor?: Cursor) => Promise<{
		transactions: T[];
		nextCursor?: Cursor;
		hasMore: boolean;
	}>,
) {
	const out: T[] = [];
	const seen = new Set<string>();
	let cursor: Cursor | undefined;
	while (true) {
		const page = await fetchPage(cursor);
		out.push(...page.transactions);
		if (!page.hasMore) return out;
		const next = page.nextCursor;
		if (!next?.date || next.id === undefined || !page.transactions.length)
			throw new Error("Incomplete transaction pagination");
		const key = `${next.date.seconds}:${next.date.nanos}:${next.id}`;
		if (seen.has(key))
			throw new Error("Transaction pagination did not advance");
		seen.add(key);
		cursor = next;
	}
}
