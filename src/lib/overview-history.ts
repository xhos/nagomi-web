import {
	addDays,
	addMonths,
	isSameMonth,
	startOfDay,
	startOfMonth,
	subMonths,
} from "date-fns";

export function comparisonMonths(month: Date, lookback: number, dates: Date[]) {
	const earliest = dates.reduce<Date | undefined>(
		(first, date) => (!first || date < first ? date : first),
		undefined,
	);
	if (!earliest) return [];
	return Array.from({ length: lookback }, (_, i) =>
		subMonths(startOfMonth(month), i + 1),
	).filter(
		(m) =>
			m > startOfMonth(earliest) ||
			(isSameMonth(m, earliest) && earliest.getDate() === 1),
	);
}

export function nextOccurrence(
	last: Date,
	monthly: boolean,
	gap: number,
	today: Date,
) {
	const next = startOfDay(monthly ? addMonths(last, 1) : addDays(last, gap));
	// Once an expected payment is missed, do not invent future occurrences.
	return next < startOfDay(today) ? undefined : next;
}
