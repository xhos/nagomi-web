import type { Metadata } from "next";
import { geistMono } from "@/fonts/geist-mono";
import { lora } from "@/fonts/lora";
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
			<head>
				<script
					dangerouslySetInnerHTML={{
						__html: `
              (function() {
                try {
                  const cookie = document.cookie
                    .split("; ")
                    .find((row) => row.startsWith("sidebar_state="));
                  if (cookie) {
                    const isExpanded = cookie.substring("sidebar_state=".length) === "true";
                    if (!isExpanded) {
                      document.documentElement.setAttribute("data-sidebar-collapsed", "true");
                    }
                  }
                } catch (e) {}
              })();
            `,
					}}
				/>
			</head>
			<body
				className={`${satoshi.variable} ${geistMono.variable} ${lora.variable} antialiased`}
			>
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
