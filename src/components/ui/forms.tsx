import { cn } from "@/lib/utils";
import { Label } from "./label";

export function Field({
	label,
	htmlFor,
	hint,
	className,
	children,
}: {
	label: string;
	htmlFor?: string;
	hint?: React.ReactNode;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div className={cn("space-y-1.5", className)}>
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
			{hint && <p className="text-sm text-muted-foreground">{hint}</p>}
		</div>
	);
}

export function FormError({ children }: { children: React.ReactNode }) {
	if (!children) return null;
	return <p className="text-sm text-destructive">{children}</p>;
}

export const NativeSelect = ({
	className,
	...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) => (
	<select
		className={cn(
			"flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 text-sm outline-none",
			"focus-visible:border-ring focus-visible:ring-[1px] focus-visible:ring-ring/20",
			"disabled:cursor-not-allowed disabled:opacity-50",
			className,
		)}
		{...props}
	/>
);
