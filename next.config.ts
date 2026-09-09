import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	eslint: {
		ignoreDuringBuilds: true,
	},
	allowedDevOrigins: ["nagomi.lab.xhos.dev"],
	webpack: (config) => {
		config.resolve.alias = {
			...config.resolve.alias,
			"@/gen": path.resolve(__dirname, "src/gen"),
		};
		return config;
	},
	turbopack: {
		resolveAlias: {
			"@/gen": "./src/gen",
		},
	},
};

export default nextConfig;
