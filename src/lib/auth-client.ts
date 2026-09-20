import { createAuthClient } from "better-auth/react";
import { DEMO } from "@/lib/demo";
import { demoAuthClient } from "@/lib/demo/auth";
import { gatewayUrl } from "@/lib/gateway-url";

const realAuthClient = () =>
	createAuthClient({
		baseURL: gatewayUrl(),
		fetchOptions: {
			credentials: "include",
		},
	});

export const authClient = DEMO
	? (demoAuthClient as unknown as ReturnType<typeof realAuthClient>)
	: realAuthClient();
