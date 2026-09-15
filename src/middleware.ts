import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const publicRoutes = ["/login"];

export async function middleware(request: NextRequest) {
	const path = request.nextUrl.pathname;

	if (publicRoutes.some((route) => path.startsWith(route))) {
		return NextResponse.next();
	}

	const sessionToken =
		process.env.NEXT_PUBLIC_DEMO === "1"
			? request.cookies.get("demo-session")?.value === "1" || undefined
			: request.cookies.get("better-auth.session_token") ||
				request.cookies.get("__Secure-better-auth.session_token");

	if (!sessionToken) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	// note: we only check cookie presence here, not validity.
	// full validation happens in api routes via authClient.getSession()

	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * match all request paths except for the ones starting with:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico
		 * - public folder
		 */
		"/((?!_next/static|_next/image|favicon.ico|public).*)",
	],
};
