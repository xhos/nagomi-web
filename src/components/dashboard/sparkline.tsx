export function Sparkline({
	values,
	width = 96,
	height = 24,
	className,
}: {
	values: number[];
	width?: number;
	height?: number;
	className?: string;
}) {
	if (values.length < 2) return null;
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	const pad = 2;
	const pts = values.map((v, i) => [
		pad + (i / (values.length - 1)) * (width - pad * 2),
		pad + (1 - (v - min) / span) * (height - pad * 2),
	]);
	const d = pts
		.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
		.join(" ");
	const [lx, ly] = pts[pts.length - 1];
	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			className={className}
			aria-hidden
		>
			<path
				d={d}
				fill="none"
				stroke="currentColor"
				strokeWidth={1.5}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			<circle cx={lx} cy={ly} r={2} fill="currentColor" />
		</svg>
	);
}
