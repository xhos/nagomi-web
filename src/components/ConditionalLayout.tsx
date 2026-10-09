"use client";

import { usePathname } from "next/navigation";
import { TopNav } from "./TopNav";

export default function ConditionalLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	if (usePathname() === "/login") return children;
	return (
		<div className="flex min-h-screen flex-col">
			<TopNav />
			<main className="flex flex-1 flex-col">{children}</main>
		</div>
	);
}
