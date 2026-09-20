import type { Metadata } from "next";

export const metadata: Metadata = { title: "categories" };

export default function CategoriesLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return children;
}
