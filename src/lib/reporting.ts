import type { Money } from "@/gen/google/type/money_pb";
import { formatAmount } from "@/lib/utils/transaction";

export const REPORTING_CURRENCY = "CAD";

export function reportingAmount(
	amount: Money | undefined,
	rates: Record<string, number>,
): number {
	if (!amount) return 0;
	const rate =
		amount.currencyCode === REPORTING_CURRENCY ? 1 : rates[amount.currencyCode];
	if (!rate || !Number.isFinite(rate) || rate <= 0)
		throw new Error(`No exchange rate for ${amount.currencyCode}`);
	return Math.round(formatAmount(amount) * rate * 100) / 100;
}
