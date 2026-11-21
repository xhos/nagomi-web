"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

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

// on/off toggles (filters, presets, segmented choices) are pills; actions and inputs keep the 4px radius
export const chip = (on: boolean, className?: string) =>
	cn(
		"h-7 rounded-full border px-3 text-sm transition-colors",
		on ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
		className,
	);

export interface MultiOption {
	value: string;
	label: string;
	// shown instead of the label while searching, when nesting no longer reads
	path?: string;
	color?: string;
	depth?: number;
	note?: React.ReactNode;
	// covered by a selected parent: drawn checked but lighter
	implied?: boolean;
	// kept above the rest, past a hairline
	pinned?: boolean;
}

const defaultSearch = (options: MultiOption[], q: string) =>
	options.filter((o) => `${o.path ?? o.label}`.toLowerCase().includes(q));

// a searchable checklist in a popover: picking keeps it open, so several can be ticked in a row
export function MultiSelect({
	options,
	selected,
	onChange,
	placeholder,
	search = defaultSearch,
	align = "start",
	children,
}: {
	options: MultiOption[];
	selected: string[];
	onChange: (values: string[]) => void;
	placeholder: string;
	search?: (options: MultiOption[], query: string) => MultiOption[];
	align?: "start" | "end";
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(0);
	const q = query.trim().toLowerCase();

	const shown = useMemo(() => {
		const pinned = options.filter((o) => o.pinned);
		const rest = options.filter((o) => !o.pinned);
		if (!q) return [...pinned, ...rest];
		return [...defaultSearch(pinned, q), ...search(rest, q)];
	}, [options, q, search]);

	const toggle = (value: string) =>
		onChange(
			selected.includes(value)
				? selected.filter((v) => v !== value)
				: [...selected, value],
		);

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActive((a) => Math.min(a + 1, shown.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActive((a) => Math.max(a - 1, 0));
		} else if (e.key === "Enter" && shown[active]) {
			e.preventDefault();
			toggle(shown[active].value);
		}
	};

	return (
		<Popover
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (!o) setQuery("");
			}}
		>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent align={align} className="w-72 p-0">
				<input
					autoFocus
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setActive(0);
					}}
					onKeyDown={onKeyDown}
					placeholder={placeholder}
					aria-label={placeholder}
					autoComplete="off"
					className="w-full border-b bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
				/>
				<div
					role="listbox"
					aria-multiselectable
					className="max-h-72 overflow-y-auto p-1"
				>
					{shown.map((o, i) => {
						const checked = selected.includes(o.value);
						const afterPinned = i > 0 && shown[i - 1].pinned && !o.pinned;
						return (
							<button
								key={o.value}
								type="button"
								role="option"
								aria-selected={checked}
								onMouseMove={() => setActive(i)}
								onClick={() => toggle(o.value)}
								style={q ? undefined : { paddingLeft: 8 + (o.depth ?? 0) * 16 }}
								className={cn(
									"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
									i === active && "bg-muted",
									afterPinned &&
										"relative mt-2 before:absolute before:inset-x-0 before:-top-1 before:h-px before:bg-border",
								)}
							>
								<span
									className={cn(
										"flex size-4 shrink-0 items-center justify-center rounded-md border border-input",
										checked && "border-accent bg-accent",
										!checked && o.implied && "border-accent/40 bg-accent/40",
									)}
								>
									{(checked || o.implied) && (
										<Check
											className="size-3 text-accent-foreground"
											strokeWidth={3}
										/>
									)}
								</span>
								{o.color && (
									<span
										className="size-2 shrink-0 rounded-full"
										style={{ backgroundColor: o.color }}
									/>
								)}
								<span className="min-w-0 flex-1 truncate">
									{q ? (o.path ?? o.label) : o.label}
								</span>
								{o.note !== undefined && (
									<span className="shrink-0 text-muted-foreground tabular-nums">
										{o.note}
									</span>
								)}
							</button>
						);
					})}
					{shown.length === 0 && (
						<p className="px-2 py-3 text-sm text-muted-foreground">
							No matches
						</p>
					)}
				</div>
				{selected.length > 0 && (
					<button
						type="button"
						onClick={() => onChange([])}
						className="w-full border-t px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground"
					>
						Clear selection
					</button>
				)}
			</PopoverContent>
		</Popover>
	);
}
