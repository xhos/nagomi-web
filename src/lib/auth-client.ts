import { createAuthClient } from "better-auth/react";
import { DEMO } from "@/lib/demo";
import { demoAuthClient } from "@/lib/demo/auth";

const realAuthClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_GATEWAY_URL,
	fetchOptions: {
		credentials: "include",
	},
});

export const authClient = DEMO
	? (demoAuthClient as unknown as typeof realAuthClient)
	: realAuthClient;
