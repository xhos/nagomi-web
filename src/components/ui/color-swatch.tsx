"use client";

import { Hash } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

interface ColorSwatchProps {
	color: string;
	onChange: (color: string) => void;
	disabled?: boolean;
}

export function ColorSwatch({ color, onChange, disabled }: ColorSwatchProps) {
	const [hexInputActive, setHexInputActive] = useState(false);
	const [hexInputValue, setHexInputValue] = useState("");
	const hexInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (hexInputActive) hexInputRef.current?.focus();
	}, [hexInputActive]);

	const commitHex = (raw: string) => {
		const normalized = raw.startsWith("#") ? raw : `#${raw}`;
		if (/^#[0-9a-fA-F]{6}$/.test(normalized)) onChange(normalized);
		setHexInputActive(false);
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div
					className={`relative overflow-hidden rounded-sm border flex-shrink-0 transition-all duration-200 ease-in-out ${
						hexInputActive ? "w-28 h-9" : "w-9 h-9"
					}`}
				>
					<span
						className={`absolute inset-0 transition-opacity duration-150 ${
							hexInputActive ? "opacity-0 pointer-events-none" : "opacity-100"
						}`}
					>
						<Popover>
							<PopoverTrigger asChild>
								<button
									type="button"
									disabled={disabled}
									className="h-full w-full cursor-pointer"
									style={{ backgroundColor: color }}
								/>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-3">
								<HexColorPicker color={color} onChange={onChange} />
							</PopoverContent>
						</Popover>
					</span>
					<span
						className={`absolute inset-0 flex items-center px-2 transition-opacity duration-150 ${
							hexInputActive ? "opacity-100" : "opacity-0 pointer-events-none"
						}`}
					>
						<input
							ref={hexInputRef}
							value={hexInputValue}
							onChange={(e) => setHexInputValue(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									commitHex(hexInputValue);
								}
								if (e.key === "Escape") setHexInputActive(false);
							}}
							onBlur={() => commitHex(hexInputValue)}
							placeholder="#000000"
							maxLength={7}
							className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
						/>
					</span>
				</div>
			</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem
					onSelect={() => {
						setHexInputActive(true);
						setHexInputValue(color);
					}}
				>
					<Hash className="h-3.5 w-3.5" />
					enter hex code
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
