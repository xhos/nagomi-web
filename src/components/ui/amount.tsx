import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/transaction";

interface AmountProps extends React.ComponentProps<"span"> {
	value: number;
	currency?: string;
	// in: "+" and green; out: "−"; neutral: plain, "−" only when negative
	tone?: "in" | "out" | "neutral";
}

export function Amount({
	value,
	currency,
	tone = "neutral",
	className,
	...props
}: AmountProps) {
	const sign =
		tone === "in" ? "+" : tone === "out" ? "−" : value < 0 ? "−" : "";
	return (
		<span
			className={cn(
				"tabular-nums",
				tone === "in" && value !== 0 && "text-success",
				className,
			)}
			{...props}
		>
			{sign}
			{formatCurrency(Math.abs(value), currency)}
		</span>
	);
}
