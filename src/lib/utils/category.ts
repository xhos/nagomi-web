export function getCategoryDisplayName(slug: string): string {
	const parts = slug.split(".");
	const lastPart = parts[parts.length - 1];
	return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
}

export function getParentSlug(slug: string): string | null {
	const lastDotIndex = slug.lastIndexOf(".");
	return lastDotIndex > 0 ? slug.substring(0, lastDotIndex) : null;
}

export function getCategoryLevel(slug: string): number {
	return slug.split(".").length - 1;
}

const SLUG_PATTERN = /^[^.]+(\.[^.]+)*$/;

export function isValidSlug(slug: string): boolean {
	return slug.length <= 100 && SLUG_PATTERN.test(slug);
}

// slugs starting with the query first, then ones containing it, each alphabetical
export function searchSlugs(slugs: string[], query: string): string[] {
	const q = query.trim().toLowerCase();
	const sorted = [...slugs].sort((a, b) => a.localeCompare(b));
	if (!q) return sorted;
	return [
		...sorted.filter((s) => s.startsWith(q)),
		...sorted.filter((s) => !s.startsWith(q) && s.includes(q)),
	];
}

// what Tab fills in: the longest prefix every slug starting with the query shares
export function completeSlug(slugs: string[], query: string): string {
	const q = query.toLowerCase();
	const matches = slugs.filter((s) => s.startsWith(q));
	if (!matches.length) return query;
	const prefix = matches.reduce((p, s) => {
		while (!s.startsWith(p)) p = p.slice(0, -1);
		return p;
	});
	return prefix.length > q.length ? prefix : query;
}
