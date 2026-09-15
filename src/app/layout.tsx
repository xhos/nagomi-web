import type { Metadata } from "next";
import { satoshi } from "@/fonts/satoshi";
import "./globals.css";
import ConditionalLayout from "@/components/ConditionalLayout";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/lib/query-client";

export const metadata: Metadata = {
	title: "nagomi // financial tracker",
	description: "minimal financial transaction tracking",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${satoshi.variable} antialiased`}>
				<QueryProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange
					>
						<ConditionalLayout>{children}</ConditionalLayout>
						<Toaster />
					</ThemeProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
