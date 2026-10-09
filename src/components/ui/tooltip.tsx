"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";

import { cn } from "@/lib/utils";

function TooltipProvider({
	delayDuration = 0,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
	return (
		<TooltipPrimitive.Provider
			data-slot="tooltip-provider"
			delayDuration={delayDuration}
			{...props}
		/>
	);
}

function Tooltip({
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
	return (
		<TooltipProvider>
			<TooltipPrimitive.Root data-slot="tooltip" {...props} />
		</TooltipProvider>
	);
}

function TooltipTrigger({
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

// shaped like a popover, no arrow, and only fades
function TooltipContent({
	className,
	sideOffset = 4,
	collisionPadding = 8,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				data-slot="tooltip-content"
				sideOffset={sideOffset}
				collisionPadding={collisionPadding}
				className={cn(
					"bg-popover text-popover-foreground animate-in fade-in-0 duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 z-50 w-fit max-w-(--radix-tooltip-content-available-width) origin-(--radix-tooltip-content-transform-origin) rounded-sm border px-2 py-1 text-sm break-words shadow-md",
					className,
				)}
				{...props}
			/>
		</TooltipPrimitive.Portal>
	);
}

// one line cut off with an ellipsis, shown in full on hover only when it is cut off
function TruncatedText({
	className,
	children,
	...props
}: React.ComponentProps<"div">) {
	const ref = React.useRef<HTMLDivElement>(null);
	const [open, setOpen] = React.useState(false);
	return (
		<Tooltip
			open={open}
			onOpenChange={(next) => {
				const el = ref.current;
				setOpen(next && !!el && el.scrollWidth > el.clientWidth);
			}}
		>
			<TooltipTrigger asChild>
				<div ref={ref} className={cn("truncate", className)} {...props}>
					{children}
				</div>
			</TooltipTrigger>
			<TooltipContent align="start">{children}</TooltipContent>
		</Tooltip>
	);
}

export {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
	TruncatedText,
};
