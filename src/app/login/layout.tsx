import type { Metadata } from "next";

export const metadata: Metadata = { title: "login" };

export default function LoginLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return children;
}
