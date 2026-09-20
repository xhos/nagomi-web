// GATEWAY_URL is read on the server per request and handed to the browser as
// data-gateway-url on <html> (see app/layout.tsx), so one build serves any
// deployment. A NEXT_PUBLIC_ var would be inlined at `next build` instead.
export function gatewayUrl(): string {
	const url =
		typeof document === "undefined"
			? process.env.GATEWAY_URL
			: document.documentElement.dataset.gatewayUrl;
	if (!url) throw new Error("GATEWAY_URL is not set");
	return url;
}
