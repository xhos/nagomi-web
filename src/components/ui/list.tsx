"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ListGroup({
	title,
	note,
	className,
	children,
	...props
}: React.ComponentProps<"section"> & {
	title: React.ReactNode;
	note?: React.ReactNode;
}) {
	return (
		<section className={cn("min-w-0", className)} {...props}>
			<div className="flex items-baseline justify-between gap-4 border-b pb-2 text-sm font-medium">
				<span>{title}</span>
				{note && (
					<span className="font-normal text-muted-foreground">{note}</span>
				)}
			</div>
			<div className="divide-y">{children}</div>
		</section>
	);
}

// a clickable row whose hover wash bleeds 12px past the text edge without widening the hairlines
export function ListRow({
	expanded,
	selected,
	className,
	onClick,
	children,
	...props
}: React.ComponentProps<"div"> & { expanded?: boolean; selected?: boolean }) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: rows contain their own buttons
		<div
			role="button"
			tabIndex={0}
			data-expanded={expanded || undefined}
			data-selected={selected || undefined}
			onClick={onClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" && e.target === e.currentTarget)
					onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
			}}
			className={cn(
				"group relative isolate cursor-pointer py-2 outline-none",
				"before:absolute before:inset-y-0 before:-inset-x-3 before:-z-10 before:rounded-md before:transition-colors",
				"hover:before:bg-muted/60 focus-visible:before:bg-muted/60 data-expanded:before:bg-muted/40",
				"data-selected:before:bg-accent/10 data-selected:hover:before:bg-accent/15",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export function DetailRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex gap-4 py-1 text-sm">
			<span className="w-28 shrink-0 text-muted-foreground">{label}</span>
			<span className="min-w-0 flex-1 break-words">{children}</span>
		</div>
	);
}

export function EmptyState({
	text,
	action,
	onAction,
}: {
	text: string;
	action?: string;
	onAction?: () => void;
}) {
	return (
		<div className="flex flex-col items-center gap-3 py-16 text-center">
			<p className="text-sm text-muted-foreground">{text}</p>
			{action && onAction && (
				<Button variant="outline" size="sm" onClick={onAction}>
					{action}
				</Button>
			)}
		</div>
	);
}

export function RowMenuButton(props: React.ComponentProps<"button">) {
	return (
		<button
			type="button"
			{...props}
			className={cn(
				"mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-opacity",
				"opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
				"hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
				props.className,
			)}
		/>
	);
}
