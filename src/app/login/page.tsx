"use client";

import { CornerDownLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function LoadingOverlay({ isExiting = false }: { isExiting?: boolean }) {
	const particleRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = particleRef.current;
		if (!el) return;
		const randomize = () => {
			// Post-impact ~80% of pre-impact horizontal reach (60vw) → 20% velocity drop.
			// Angle matches velocity vector in pixel space so the trail orients along the path.
			const dxVw = 44 + Math.random() * 10; // 44–54 vw (avg ~48 = 80% of 60)
			const dyVh = (Math.random() - 0.5) * 24; // −12 to +12 vh
			const dxPx = (dxVw * window.innerWidth) / 100;
			const dyPx = (dyVh * window.innerHeight) / 100;
			const angleDeg = (Math.atan2(dyPx, dxPx) * 180) / Math.PI;
			el.style.setProperty("--dx", `${dxVw}vw`);
			el.style.setProperty("--dy", `${dyVh}vh`);
			el.style.setProperty("--angle", `${angleDeg}deg`);
		};
		randomize();
		el.addEventListener("animationiteration", randomize);
		return () => el.removeEventListener("animationiteration", randomize);
	}, []);

	return (
		<div className="fixed inset-0 z-50 overflow-hidden bg-background animate-overlay-in">
			<div
				className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ease-out ${
					isExiting ? "opacity-0" : "opacity-100"
				}`}
			>
				<div className="font-mono text-6xl font-medium tracking-tight animate-impact will-change-transform">
					null
				</div>
				<div
					ref={particleRef}
					className="pointer-events-none absolute h-[2px] w-12 animate-particle-hit will-change-transform"
					style={{
						top: "calc(50% - 1px)",
						left: "calc(50% - 1.5rem)",
						background:
							"linear-gradient(to right, transparent 0%, var(--color-accent-primary) 100%)",
						boxShadow:
							"0 0 12px 1px color-mix(in oklch, var(--color-accent-primary) 60%, transparent)",
					}}
				/>
			</div>
		</div>
	);
}

function ArtworkPanel() {
	const gridId = useId();
	return (
		<div className="relative hidden h-full w-full overflow-hidden bg-card lg:block">
			{/* Grid pattern */}
			<div className="absolute inset-0 opacity-[0.04]">
				<svg
					width="100%"
					height="100%"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
				>
					<defs>
						<pattern
							id={gridId}
							width="48"
							height="48"
							patternUnits="userSpaceOnUse"
						>
							<path
								d="M 48 0 L 0 0 0 48"
								fill="none"
								stroke="currentColor"
								strokeWidth="1"
							/>
						</pattern>
					</defs>
					<rect width="100%" height="100%" fill={`url(#${gridId})`} />
				</svg>
			</div>

			{/* Central branding */}
			<div className="absolute inset-0 flex flex-col items-start justify-center gap-4 p-10">
				<div className="font-mono text-6xl font-medium tracking-tight text-foreground/90">
					null
				</div>
				<div className="h-px w-24 bg-border" />
				<p className="max-w-xs font-mono text-xs leading-relaxed text-muted-foreground">
					personal finance tracking
				</p>
			</div>

			{/* Subtle accent gradient in corner */}
			<div
				className="absolute -bottom-32 -right-32 h-64 w-64 rounded-full opacity-[0.10] blur-3xl"
				style={{ backgroundColor: "oklch(0.6076 0.1561 305.32)" }}
			/>
		</div>
	);
}

export default function LoginPage() {
	const router = useRouter();
	const [mode, setMode] = useState<"login" | "register">("login");
	const [email, setEmail] = useState(initial("email"));
	const [password, setPassword] = useState(initial("password"));
	const [name, setName] = useState(initial("name"));
	const [isLoading, setIsLoading] = useState(false);
	const [isExiting, setIsExiting] = useState(false);
	const [error, setError] = useState("");
	const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
	const nameId = useId();
	const emailId = useId();
	const passwordId = useId();
	const nameRef = useRef<HTMLInputElement>(null);
	const emailRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const checkSession = async () => {
			try {
				const session = await authClient.getSession();
				if (session.data?.user) {
					router.push("/");
				} else {
					setIsLoggedIn(false);
				}
			} catch (err) {
				console.error("[login] getSession error:", err);
				setIsLoggedIn(false);
			}
		};
		checkSession();
	}, [router]);

	const modeInitialized = useRef(false);
	useEffect(() => {
		if (!modeInitialized.current) {
			modeInitialized.current = true;
			return;
		}
		const firstField = mode === "login" ? emailRef.current : nameRef.current;
		requestAnimationFrame(() => {
			firstField?.focus();
		});
	}, [mode]);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey) return;

			const active = document.activeElement as HTMLElement | null;
			const isField =
				!!active &&
				(active.tagName === "INPUT" ||
					active.tagName === "TEXTAREA" ||
					active.isContentEditable);

			if (e.key === "Escape") {
				active?.blur?.();
				return;
			}
			if (isField) return;

			const key = e.key.toLowerCase();
			if (key !== "l" && key !== "s") return;
			e.preventDefault();
			const newMode = key === "l" ? "login" : "register";
			setMode(newMode);
			setError("");
			setEmail(initial("email"));
			setPassword(initial("password"));
			setName(initial("name"));
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	const handleAuth = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			if (mode === "register") {
				const signUpResult = await authClient.signUp.email({
					email,
					password,
					name,
				});
				if (signUpResult.error)
					throw new Error(signUpResult.error.message || "Registration failed");
			}

			const result = await authClient.signIn.email({ email, password });
			if (result.error)
				throw new Error(result.error.message || "Invalid email or password");

			// Fade overlay content out, then navigate. Background color stays solid
			// throughout so the login form underneath never peeks through.
			setIsExiting(true);
			await new Promise((resolve) => setTimeout(resolve, 500));
			router.push("/");
			// keep isLoading=true so overlay persists through navigation (no flicker)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Operation failed");
			setIsLoading(false);
		}
	};

	const switchMode = (newMode: "login" | "register") => {
		setMode(newMode);
		setError("");
		setEmail(initial("email"));
		setPassword(initial("password"));
		setName(initial("name"));
	};

	if (isLoggedIn === null) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="font-mono text-sm text-muted-foreground">
					checking session...
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen">
			{isLoading && <LoadingOverlay isExiting={isExiting} />}
			{/* Left: Artwork */}
			<div className="hidden lg:flex lg:w-1/2">
				<ArtworkPanel />
			</div>

			{/* Right: Form */}
			<div className="flex w-full flex-col justify-center px-6 py-16 lg:w-1/2 lg:px-0">
				<div
					className={`mx-auto w-full max-w-sm ${mode === "login" ? "pb-[74px]" : ""}`}
				>
					{/* Mobile-only branding */}
					<div className="mb-8 lg:hidden">
						<div className="font-mono text-2xl font-bold tracking-tighter text-foreground">
							null
						</div>
					</div>

					{/* Mode toggle */}
					<div className="mb-6 flex items-baseline gap-6 font-mono text-xs">
						<button
							type="button"
							onClick={() => switchMode("login")}
							className={`transition-colors duration-150 ${
								mode === "login"
									? "text-foreground"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<span className={mode === "login" ? "text-accent" : "invisible"}>
								&gt;
							</span>{" "}
							<span className="underline decoration-dotted decoration-1 underline-offset-[3px]">
								l
							</span>
							ogin
						</button>
						<button
							type="button"
							onClick={() => switchMode("register")}
							className={`transition-colors duration-150 ${
								mode === "register"
									? "text-foreground"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<span
								className={mode === "register" ? "text-accent" : "invisible"}
							>
								&gt;
							</span>{" "}
							<span className="underline decoration-dotted decoration-1 underline-offset-[3px]">
								s
							</span>
							ign up
						</button>
					</div>

					{/* Form */}
					<form onSubmit={handleAuth} className="space-y-4">
						{mode === "register" && (
							<div className="space-y-1.5">
								<Label
									htmlFor={nameId}
									className="font-mono text-xs text-muted-foreground"
								>
									name
								</Label>
								<Input
									id={nameId}
									ref={nameRef}
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="your display name"
									disabled={isLoading || DEMO}
									required
								/>
							</div>
						)}

						<div className="space-y-1.5">
							<Label
								htmlFor={emailId}
								className="font-mono text-xs text-muted-foreground"
							>
								email
							</Label>
							<Input
								id={emailId}
								ref={emailRef}
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="your@email.com"
								disabled={isLoading || DEMO}
								required
							/>
						</div>

						<div className="space-y-1.5">
							<Label
								htmlFor={passwordId}
								className="font-mono text-xs text-muted-foreground"
							>
								password
							</Label>
							<div className="flex gap-2">
								<Input
									id={passwordId}
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder={
										mode === "login" ? "your password" : "create a password"
									}
									disabled={isLoading || DEMO}
									required
									className="flex-1"
								/>
								<Button
									type="submit"
									size="icon"
									className="w-[72px]"
									disabled={isLoading}
									aria-label={mode === "login" ? "sign in" : "create account"}
								>
									{isLoading ? (
										<Loader2 className="animate-spin" />
									) : (
										<CornerDownLeft />
									)}
								</Button>
							</div>
						</div>
					</form>

					{error && (
						<div className="mt-4 border border-destructive/30 p-3 font-mono text-xs text-destructive">
							{error}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
