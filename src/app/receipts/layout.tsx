import type { Metadata } from "next";

export const metadata: Metadata = { title: "receipts" };

export default function ReceiptsLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return children;
}
