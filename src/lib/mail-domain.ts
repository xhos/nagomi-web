import { DEMO } from "@/lib/demo";

// MAIL_DOMAIN reaches the browser the same way as GATEWAY_URL (see
// gateway-url.ts). Unset means the email parser isn't deployed.
export function mailDomain(): string | undefined {
	if (DEMO) return "mail.nagomi.example";
	const domain =
		typeof document === "undefined"
			? process.env.MAIL_DOMAIN
			: document.documentElement.dataset.mailDomain;
	return domain || undefined;
}
