import type { Metadata } from "next";
import { satoshi } from "@/fonts/satoshi";
import "./globals.css";
import ConditionalLayout from "@/components/ConditionalLayout";
import { ThemeFavicon } from "@/components/theme-favicon";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { DEMO } from "@/lib/demo";
import { gatewayUrl } from "@/lib/gateway-url";
import { QueryProvider } from "@/lib/query-client";

// the gateway URL is read from the environment per request, never at build time
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: { default: "nagomi", template: "%s · nagomi" },
	description: "minimal financial transaction tracking",
	icons: { apple: "/apple-icon.png" },
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			data-gateway-url={DEMO ? undefined : gatewayUrl()}
		>
			<body className={`${satoshi.variable} antialiased`}>
				<QueryProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange
					>
						<ThemeFavicon />
						<ConditionalLayout>{children}</ConditionalLayout>
						<Toaster />
					</ThemeProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
