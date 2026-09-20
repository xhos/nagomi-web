import type { Metadata } from "next";

export const metadata: Metadata = { title: "rules" };

export default function RulesLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return children;
}
