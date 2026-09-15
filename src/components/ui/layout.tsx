import { cn } from "@/lib/utils";

export const PageContainer = ({
	children,
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("min-h-screen", className)} {...props}>
		{children}
	</div>
);

export const PageContent = ({
	children,
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn("mx-auto w-full max-w-[1200px] px-6 pt-10 pb-8", className)}
		{...props}
	>
		{children}
	</div>
);

export const DashboardPageContent = ({
	children,
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("mx-auto max-w-[1600px] px-6 py-8", className)} {...props}>
		{children}
	</div>
);

export const PageHeader = ({
	children,
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<header className={cn("mb-6", className)} {...props}>
		{children}
	</header>
);

export const PageHeaderWithTitle = ({
	title,
	subtitle,
	actions,
	className,
	...props
}: {
	title: string;
	subtitle?: React.ReactNode;
	actions?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => (
	<PageHeader className={className} {...props}>
		<div className="flex min-h-9 flex-wrap items-center justify-between gap-4">
			<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
			{actions && <ActionBar>{actions}</ActionBar>}
		</div>
		{subtitle && (
			<div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
		)}
	</PageHeader>
);

export const ActionBar = ({
	children,
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("flex items-center gap-2", className)} {...props}>
		{children}
	</div>
);

export const InfoGrid = ({
	children,
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("space-y-2", className)} {...props}>
		{children}
	</div>
);

export const InfoRow = ({
	label,
	children,
	className,
	...props
}: {
	label: string;
	children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("flex gap-4", className)} {...props}>
		<span className="text-sm text-muted-foreground min-w-[120px] shrink-0">
			{label}
		</span>
		<div className="flex-1">{children}</div>
	</div>
);

export const Stat = ({
	label,
	value,
	className,
	...props
}: {
	label: string;
	value: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn("flex justify-between items-center", className)}
		{...props}
	>
		<span className="text-sm text-muted-foreground">{label}</span>
		<div>{value}</div>
	</div>
);
