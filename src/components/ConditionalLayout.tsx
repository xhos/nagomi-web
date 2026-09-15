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
		<>
			<TopNav />
			<main>{children}</main>
		</>
	);
}
