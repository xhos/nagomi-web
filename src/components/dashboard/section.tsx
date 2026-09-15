import { cn } from "@/lib/utils";

export function Section({
	title,
	note,
	className,
	children,
}: {
	title: string;
	note?: React.ReactNode;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<section className={cn("min-w-0", className)}>
			<div className="flex items-baseline justify-between gap-4 border-b pb-2">
				<h2 className="text-base font-semibold">{title}</h2>
				{note && <span className="text-sm text-muted-foreground">{note}</span>}
			</div>
			{children}
		</section>
	);
}
