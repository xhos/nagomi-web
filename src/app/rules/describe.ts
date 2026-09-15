import type { TransactionRule } from "@/lib/rules";
import {
	FIELD_OPTIONS,
	NUMERIC_OPERATOR_OPTIONS,
	STRING_OPERATOR_OPTIONS,
	TX_DIRECTION_OPTIONS,
} from "./components/rule-dialog-constants";

const label = (
	opts: readonly { value: string | number; label: string }[],
	v: unknown,
) => opts.find((o) => o.value === v)?.label ?? String(v);

// one plain sentence per condition, e.g. `Merchant contains "Loblaws"`
export function describeRule(conditions: unknown): {
	logic: "and" | "or";
	parts: string[];
} {
	const rule = conditions as Partial<TransactionRule> | undefined;
	if (!rule?.conditions || !Array.isArray(rule.conditions))
		return { logic: "and", parts: [] };
	const parts = rule.conditions.map((c) => {
		const field = label(FIELD_OPTIONS, c.field);
		const op = label(
			[...STRING_OPERATOR_OPTIONS, ...NUMERIC_OPERATOR_OPTIONS],
			c.operator,
		);
		let value = "";
		if ("values" in c && c.values?.length) value = c.values.join(", ");
		else if ("min_value" in c && c.min_value !== undefined)
			value = `${c.min_value} and ${c.max_value}`;
		else if (c.field === "tx_direction")
			value = label(TX_DIRECTION_OPTIONS, c.value).toLowerCase();
		else if (c.value !== undefined)
			value = typeof c.value === "string" ? `"${c.value}"` : String(c.value);
		const cs =
			"case_sensitive" in c && c.case_sensitive ? " (case sensitive)" : "";
		return `${field} ${op} ${value}${cs}`.trim();
	});
	return { logic: rule.logic === "OR" ? "or" : "and", parts };
}
