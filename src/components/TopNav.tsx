"use client";

import { ChevronDown, LogOut, Moon, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/hooks/useSession";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const NAV = [
	["overview", "/"],
	["transactions", "/transactions"],
	["receipts", "/receipts"],
	["accounts", "/accounts"],
	["friends", "/friends"],
	["categories", "/categories"],
	["rules", "/rules"],
] as const;

// a running head, not a toolbar: text in the content column, no band, no border
export function TopNav() {
	const pathname = usePathname();
	const router = useRouter();
	const { theme, setTheme } = useTheme();
	const { data: session } = useSession();
	const user = session?.data?.user;
	const name = user?.name || user?.email?.split("@")[0] || "account";

	return (
		<div className="mx-auto flex w-full max-w-[1200px] items-baseline gap-6 px-6 pt-5 text-sm">
			<Link href="/" className="shrink-0 font-semibold text-foreground">
				nagomi
			</Link>
			<nav className="scrollbar-hide flex min-w-0 flex-1 gap-4 overflow-x-auto">
				{NAV.map(([label, href]) => {
					const active = pathname === href;
					return (
						<Link
							key={href}
							href={href}
							aria-current={active ? "page" : undefined}
							className={cn(
								"shrink-0 transition-colors",
								active
									? "text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{label}
						</Link>
					);
				})}
			</nav>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="flex shrink-0 items-center gap-1 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
					>
						{name}
						<ChevronDown className="size-3.5" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-52">
					{user?.email && (
						<>
							<div className="truncate px-2 py-1.5 text-sm text-muted-foreground">
								{user.email}
							</div>
							<DropdownMenuSeparator />
						</>
					)}
					<DropdownMenuItem
						onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
					>
						{theme === "dark" ? <Sun /> : <Moon />}
						{theme === "dark" ? "Light mode" : "Dark mode"}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => router.push("/settings")}>
						<Settings /> Settings
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onClick={async () => {
							await authClient.signOut();
							router.push("/login");
						}}
					>
						<LogOut /> Sign out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
