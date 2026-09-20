import type { Metadata } from "next";

export const metadata: Metadata = { title: "friends" };

export default function FriendsLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return children;
}
