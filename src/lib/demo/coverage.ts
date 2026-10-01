// core's statement coverage (nagomi-core internal/service/statement_coverage.go),
// ported so the demo reports missing and due statements the way core does.
// planCoverage mirrors core's planCoverage; keep them in step.
import { StatementCoverageStatus } from "@/gen/nagomi/v1/statement_pb";

// without a release day, a statement is due this many days after its period ends
const RELEASE_LAG_DAYS = 3;
// bounds the periods generated around a statement, in case of a decades-old one
const MAX_PERIODS = 600;

// all dates here are calendar days at midnight UTC
export const utcDay = (year: number, month: number, day: number) =>
	new Date(Date.UTC(year, month - 1, day));
const addDays = (d: Date, n: number) =>
	new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));

// the day of the month, or its last day when the month is shorter; month may
// run past december or before january (1-based, like time.Month)
function dayInMonth(year: number, month: number, day: number) {
	const first = new Date(Date.UTC(year, month - 1, 1));
	const lastDay = new Date(
		Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
	).getUTCDate();
	return addDays(first, Math.min(day, lastDay) - 1);
}

// moves d by n months, keeping its day where the month is long enough
const addMonthsClamped = (d: Date, n: number) =>
	dayInMonth(d.getUTCFullYear(), d.getUTCMonth() + 1 + n, d.getUTCDate());

export interface CoverageStatement {
	id: bigint;
	start: Date;
	end: Date;
	balanceOk?: boolean;
}

export interface CoverageSettings {
	// periods starting before this aren't expected
	statementsStart?: Date;
	releaseDay?: number;
	// periods starting after this aren't expected
	closedAt?: Date;
}

export interface CoveragePeriod {
	start: Date;
	end: Date;
	status: StatementCoverageStatus;
	statementId?: bigint;
}

function releaseDate(end: Date, releaseDay?: number) {
	if (releaseDay === undefined) return addDays(end, RELEASE_LAG_DAYS);
	let release = dayInMonth(
		end.getUTCFullYear(),
		end.getUTCMonth() + 1,
		releaseDay,
	);
	if (release <= end)
		release = dayInMonth(
			end.getUTCFullYear(),
			end.getUTCMonth() + 2,
			releaseDay,
		);
	return release;
}

function monthlyPeriods(from: Date, to: Date, status: StatementCoverageStatus) {
	const out: CoveragePeriod[] = [];
	for (let i = 0; i < MAX_PERIODS; i++) {
		const start = addMonthsClamped(from, i);
		if (start > to) break;
		let end = addDays(addMonthsClamped(from, i + 1), -1);
		if (end > to) end = to;
		out.push({ start, end, status });
	}
	return out;
}

// an account's statements as consecutive periods, oldest first: missing ones before
// the first statement and between statements, then the ones due since the last.
// statements must be sorted by start.
export function planCoverage(
	statements: CoverageStatement[],
	settings: CoverageSettings,
	today: Date,
): CoveragePeriod[] {
	const MISSING = StatementCoverageStatus.MISSING;

	if (statements.length === 0) {
		// nothing to tell the cycle from, so one stretch from the start
		if (!settings.statementsStart) return [];
		let end = today;
		if (settings.closedAt && settings.closedAt < end) end = settings.closedAt;
		if (settings.statementsStart > end) return [];
		return [{ start: settings.statementsStart, end, status: MISSING }];
	}

	const out: CoveragePeriod[] = [];

	const first = statements[0].start;
	if (settings.statementsStart) {
		const before: CoveragePeriod[] = [];
		for (let i = 1; i <= MAX_PERIODS; i++) {
			const start = addMonthsClamped(first, -i);
			if (start < settings.statementsStart) break;
			before.push({
				start,
				end: addDays(addMonthsClamped(first, 1 - i), -1),
				status: MISSING,
			});
		}
		out.push(...before.reverse());
	}

	// the last day some statement covers; statements may overlap
	let covered = addDays(first, -1);
	for (const s of statements) {
		const gapStart = addDays(covered, 1);
		if (gapStart < s.start)
			out.push(...monthlyPeriods(gapStart, addDays(s.start, -1), MISSING));
		out.push({
			start: s.start,
			end: s.end,
			status:
				s.balanceOk === false
					? StatementCoverageStatus.UNBALANCED
					: StatementCoverageStatus.IMPORTED,
			statementId: s.id,
		});
		if (s.end > covered) covered = s.end;
	}

	for (let i = 1; i <= MAX_PERIODS; i++) {
		const start = addDays(addMonthsClamped(covered, i - 1), 1);
		const end = addMonthsClamped(covered, i);
		if (settings.closedAt && start > settings.closedAt) break;
		if (releaseDate(end, settings.releaseDay) > today) break;
		out.push({ start, end, status: StatementCoverageStatus.DUE });
	}

	return out;
}
