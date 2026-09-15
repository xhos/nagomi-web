"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/forms";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { DEMO } from "@/lib/demo";
import { DEMO_USER } from "@/lib/demo/data";

// demo builds show the form with the demo account filled in and locked
const prefill = {
	email: DEMO_USER.email,
	password: "nagomi-demo",
	name: DEMO_USER.name,
};
const initial = (k: keyof typeof prefill) => (DEMO ? prefill[k] : "");

export default function LoginPage() {
	const router = useRouter();
	const id = useId();
	const [mode, setMode] = useState<"login" | "register">("login");
	const [email, setEmail] = useState(initial("email"));
	const [password, setPassword] = useState(initial("password"));
	const [name, setName] = useState(initial("name"));
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [checked, setChecked] = useState(false);

	useEffect(() => {
		authClient
			.getSession()
			.then((s) => (s.data?.user ? router.push("/") : setChecked(true)))
			.catch(() => setChecked(true));
	}, [router]);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError("");
		try {
			if (mode === "register") {
				const r = await authClient.signUp.email({ email, password, name });
				if (r.error)
					throw new Error(r.error.message || "Couldn't create account");
			}
			const r = await authClient.signIn.email({ email, password });
			if (r.error)
				throw new Error(r.error.message || "Wrong email or password");
			router.push("/");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			setBusy(false);
		}
	};

	const switchMode = () => {
		setMode((m) => (m === "login" ? "register" : "login"));
		setError("");
	};

	if (!checked) return null;

	return (
		<div className="flex min-h-screen items-center justify-center px-6 py-16">
			<div className="w-full max-w-xs">
				<div className="mb-8">
					<div className="text-2xl font-semibold tracking-tight">nagomi</div>
					<p className="mt-1 text-sm text-muted-foreground">
						{mode === "login" ? "Sign in to continue." : "Create your account."}
					</p>
				</div>

				<form onSubmit={submit} className="space-y-4">
					{mode === "register" && (
						<Field label="Name" htmlFor={`${id}-name`}>
							<Input
								id={`${id}-name`}
								value={name}
								onChange={(e) => setName(e.target.value)}
								disabled={busy || DEMO}
								required
								autoFocus
							/>
						</Field>
					)}
					<Field label="Email" htmlFor={`${id}-email`}>
						<Input
							id={`${id}-email`}
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={busy || DEMO}
							required
							autoFocus={mode === "login"}
						/>
					</Field>
					<Field label="Password" htmlFor={`${id}-password`}>
						<Input
							id={`${id}-password`}
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={busy || DEMO}
							required
						/>
					</Field>

					<FormError>{error}</FormError>

					<Button type="submit" className="w-full" disabled={busy}>
						{busy
							? mode === "login"
								? "Signing in…"
								: "Creating account…"
							: mode === "login"
								? "Sign in"
								: "Create account"}
					</Button>
				</form>

				{!DEMO && (
					<p className="mt-6 text-sm text-muted-foreground">
						{mode === "login" ? "New here? " : "Have an account? "}
						<button
							type="button"
							onClick={switchMode}
							className="text-foreground underline underline-offset-2"
						>
							{mode === "login" ? "Create an account" : "Sign in"}
						</button>
					</p>
				)}
			</div>
		</div>
	);
}
