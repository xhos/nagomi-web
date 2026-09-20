"use client";

import Script from "next/script";
import { useTheme } from "next-themes";
import { useEffect } from "react";

// replaces the svg favicon link so the browser refetches it
function setFavicon(theme: string) {
	for (const el of document.querySelectorAll(
		'link[rel="icon"][type="image/svg+xml"]',
	)) {
		el.remove();
	}
	const link = document.createElement("link");
	link.rel = "icon";
	link.type = "image/svg+xml";
	link.sizes.add("any");
	link.href = `/icon-${theme === "dark" ? "dark" : "light"}.svg`;
	document.head.appendChild(link);
}

// runs before hydration so the first paint already has the right icon;
// reads the same localStorage key next-themes writes
const initial = `(function(){try{var t=localStorage.getItem("theme");if(!t||t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var l=document.createElement("link");l.rel="icon";l.type="image/svg+xml";l.sizes.add("any");l.href="/icon-"+(t==="dark"?"dark":"light")+".svg";document.head.appendChild(l)}catch(e){}})()`;

export function ThemeFavicon() {
	const { resolvedTheme } = useTheme();
	useEffect(() => {
		if (resolvedTheme) setFavicon(resolvedTheme);
	}, [resolvedTheme]);
	return (
		<Script id="theme-favicon" strategy="beforeInteractive">
			{initial}
		</Script>
	);
}
