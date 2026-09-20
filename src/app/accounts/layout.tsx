import type { Metadata } from "next";

export const metadata: Metadata = { title: "accounts" };

export default function AccountsLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return children;
}
