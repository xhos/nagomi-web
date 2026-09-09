import { TransactionDirection } from "@/gen/nagomi/v1/enums_pb";
import type { Transaction } from "@/gen/nagomi/v1/transaction_pb";

export interface AmountType {
	currencyCode?: string;
	currency_code?: string;
	units?: string | bigint;
	nanos?: number;
}

export interface TimestampType {
	seconds?: string | bigint;
	nanos?: number;
}

export function formatAmount(amount?: AmountType): number {
	if (!amount?.units) return 0;
	const units =
		typeof amount.units === "bigint"
			? Number(amount.units)
			: parseFloat(amount.units);
	return units + (amount.nanos || 0) / 1e9;
}

export function formatCurrency(amount: number, currencyCode = "USD"): string {
	const isValidCurrency =
		currencyCode &&
		currencyCode.length === 3 &&
		/^[A-Z]{3}$/.test(currencyCode);
	const finalCurrencyCode = isValidCurrency ? currencyCode : "USD";

	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: finalCurrencyCode,
		}).format(amount);
	} catch {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	}
}

export function formatDate(timestamp?: TimestampType | string) {
	let date: Date;

	if (!timestamp) return { date: "", displayDate: "" };

	if (typeof timestamp === "string") {
		date = new Date(timestamp);
	} else if (timestamp.seconds) {
		const seconds =
			typeof timestamp.seconds === "bigint"
				? Number(timestamp.seconds)
				: parseInt(timestamp.seconds, 10);
		date = new Date(seconds * 1000);
	} else {
		return { date: "", displayDate: "" };
	}

	if (Number.isNaN(date.getTime())) {
		return { date: "", displayDate: "" };
	}

	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const dateOnly = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	);
	const diffInMs = today.getTime() - dateOnly.getTime();
	const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

	const isCurrentYear = date.getFullYear() === now.getFullYear();

	let displayDate: string;

	// Today
	if (diffInDays === 0) {
		displayDate = "today";
	}
	// Yesterday
	else if (diffInDays === 1) {
		displayDate = "yesterday";
	}
	// Within the last 7 days - show day name
	else if (diffInDays > 1 && diffInDays < 7) {
		displayDate = date
			.toLocaleDateString("en-US", { weekday: "long" })
			.toLowerCase();
	}
	// Older - show full date
	else {
		const displayOptions: Intl.DateTimeFormatOptions = {
			month: "long",
			day: "numeric",
		};
		if (!isCurrentYear) {
			displayOptions.year = "numeric";
		}
		displayDate = date
			.toLocaleDateString("en-US", displayOptions)
			.toLowerCase();
	}

	return {
		date: date.toISOString().split("T")[0],
		displayDate,
	};
}

export function formatTime(timestamp?: TimestampType | string): string {
	let date: Date;

	if (typeof timestamp === "string") {
		date = new Date(timestamp);
	} else if (timestamp?.seconds) {
		const seconds =
			typeof timestamp.seconds === "bigint"
				? Number(timestamp.seconds)
				: parseInt(String(timestamp.seconds), 10);
		date = new Date(seconds * 1000);
	} else {
		return "—";
	}

	return date.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

export function getDirectionDisplay(direction: TransactionDirection) {
	const normalizedDirection =
		typeof direction === "string"
			? TransactionDirection[direction as keyof typeof TransactionDirection]
			: direction;

	if (normalizedDirection === TransactionDirection.DIRECTION_INCOMING) {
		return { symbol: "+", className: "text-success", label: "in" };
	}
	return { symbol: "-", className: "text-destructive", label: "out" };
}

export function getCategorizationStatus(transaction: Transaction) {
	if (!transaction.categoryId) {
		return { text: "none", variant: "outline" as const };
	}
	if (transaction.categoryManuallySet) {
		return { text: "manual", variant: "secondary" as const };
	}
	return { text: "auto", variant: "default" as const };
}

export function getMerchantStatus(transaction: Transaction) {
	if (!transaction.merchant) {
		return { text: "none", variant: "outline" as const };
	}
	if (transaction.merchantManuallySet) {
		return { text: "manual", variant: "secondary" as const };
	}
	return { text: "auto", variant: "default" as const };
}

export interface DailyTransactionGroup {
	date: string;
	displayDate: string;
	transactions: Transaction[];
	totalIn: number;
	totalOut: number;
	netAmount: number;
}

export function groupTransactionsByDay(
	transactions: Transaction[],
): DailyTransactionGroup[] {
	const groups: { [key: string]: DailyTransactionGroup } = {};

	transactions.forEach((transaction) => {
		const { date, displayDate } = formatDate(transaction.txDate);
		if (!date) return;

		if (!groups[date]) {
			groups[date] = {
				date,
				displayDate,
				transactions: [],
				totalIn: 0,
				totalOut: 0,
				netAmount: 0,
			};
		}

		groups[date].transactions.push(transaction);

		const amount = formatAmount(transaction.txAmount);
		const normalizedDirection =
			typeof transaction.direction === "string"
				? TransactionDirection[
						transaction.direction as keyof typeof TransactionDirection
					]
				: transaction.direction;

		if (normalizedDirection === TransactionDirection.DIRECTION_INCOMING) {
			groups[date].totalIn += amount;
		} else {
			groups[date].totalOut += amount;
		}
		groups[date].netAmount = groups[date].totalIn - groups[date].totalOut;
	});

	return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
}
