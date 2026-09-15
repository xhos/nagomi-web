import { cn } from "@/lib/utils";

export function Figure({
	label,
	value,
	note,
	tone,
}: {
	label: string;
	value: string;
	note?: React.ReactNode;
	tone?: "good" | "bad";
}) {
	return (
		<div className="min-w-0 py-4 lg:px-6 lg:first:pl-0">
			<div className="text-sm text-muted-foreground">{label}</div>
			<div className="mt-1 truncate text-2xl font-semibold">{value}</div>
			{note && (
				<div
					className={cn(
						"mt-1 truncate text-sm text-muted-foreground",
						tone === "good" && "text-success",
						tone === "bad" && "text-destructive",
					)}
				>
					{note}
				</div>
			)}
		</div>
	);
}

export function FigureRow({ children }: { children: React.ReactNode }) {
	return (
		<div className="grid grid-cols-2 gap-x-8 border-y lg:grid-cols-4 lg:gap-x-0 lg:divide-x">
			{children}
		</div>
	);
}
