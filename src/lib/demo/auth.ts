import { DEMO_USER } from "./data";

// the subset of better-auth's client the app touches. sign-in state lives in a
// cookie so middleware and reloads behave like a real instance would
const COOKIE = "demo-session";
const signedIn = () =>
	typeof document !== "undefined" && document.cookie.includes(`${COOKIE}=1`);
const setCookie = (on: boolean) => {
	// biome-ignore lint/suspicious/noDocumentCookie: cookie store api is not in firefox
	document.cookie = `${COOKIE}=${on ? 1 : 0}; path=/; max-age=${on ? 31536000 : 0}`;
};

const session = {
	data: {
		user: {
			...DEMO_USER,
			emailVerified: true,
			image: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		session: {
			id: "demo",
			userId: DEMO_USER.id,
			token: "demo",
			expiresAt: new Date(2100, 0),
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	},
	error: null,
};
const none = { data: null, error: null };

const signIn = async () => {
	setCookie(true);
	return session;
};

export const demoAuthClient = {
	getSession: async () => (signedIn() ? session : none),
	signOut: async () => {
		setCookie(false);
		return { data: { success: true }, error: null };
	},
	signIn: { email: signIn },
	signUp: { email: signIn },
};
