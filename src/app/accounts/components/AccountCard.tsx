"use client";

import { Anchor, Merge, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Caption, Card, HStack, Muted, Text, VStack } from "@/components/lib";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Account } from "@/gen/nagomi/v1/account_pb";
import type { AccountType } from "@/gen/nagomi/v1/enums_pb";

interface AccountCardProps {
	account: Account;
	getAccountTypeName: (type: AccountType) => string;
	onClick: () => void;
	onEdit?: (account: Account) => void;
	onDelete?: (account: Account) => void;
	onSaveAnchor?: (
		account: Account,
		balance: { units: string; nanos: number },
	) => Promise<void>;
	onMerge?: (account: Account) => void;
}

export default function AccountCard({
	account,
	getAccountTypeName,
	onClick,
	onEdit,
	onDelete,
	onSaveAnchor,
	onMerge,
}: AccountCardProps) {
	const formatBalance = (balance?: {
		currencyCode?: string;
		units?: string | bigint;
		nanos?: number;
	}) => {
		const currency = account.mainCurrency || balance?.currencyCode;
		const totalAmount = balance
			? parseFloat(balance.units?.toString() || "0") +
				(balance.nanos || 0) / 1e9
			: 0;
		if (!currency) return totalAmount.toFixed(2);
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
		}).format(totalAmount);
	};

	const [isEditingAnchor, setIsEditingAnchor] = useState(false);
	const [anchorInput, setAnchorInput] = useState("");
	const [isSavingAnchor, setIsSavingAnchor] = useState(false);
	const anchorInputRef = useRef<HTMLInputElement>(null);
	const anchorCancelledRef = useRef(false);

	useEffect(() => {
		if (isEditingAnchor) anchorInputRef.current?.focus();
	}, [isEditingAnchor]);

	const handleStartAnchorEdit = () => {
		const current = account.balance
			? parseFloat(account.balance.units?.toString() || "0") +
				(account.balance.nanos || 0) / 1e9
			: 0;
		anchorCancelledRef.current = false;
		setAnchorInput(current.toFixed(2));
		setIsEditingAnchor(true);
	};

	const handleCancelAnchorEdit = () => {
		anchorCancelledRef.current = true;
		setIsEditingAnchor(false);
	};

	const handleSaveAnchor = async () => {
		if (!onSaveAnchor || anchorCancelledRef.current) return;
		const numAmount = parseFloat(anchorInput || "0");
		setIsSavingAnchor(true);
		try {
			await onSaveAnchor(account, {
				units: Math.trunc(numAmount).toString(),
				nanos: Math.round((numAmount - Math.trunc(numAmount)) * 1e9),
			});
		} finally {
			setIsSavingAnchor(false);
			setIsEditingAnchor(false);
		}
	};

	const [c1, c2, c3] =
		account.colors.length === 3 ? account.colors : [null, null, null];
	const blobGradient =
		c1 && c2 && c3
			? {
					background: `
      radial-gradient(circle at 90% 60%, ${c3} 0%, transparent 50%),
      radial-gradient(circle at 70% 5%,  ${c2} 0%, transparent 45%),
      radial-gradient(circle at 20% 75%, ${c1} 0%, transparent 50%)
    `,
				}
			: undefined;

	const hasGradient = !!blobGradient;

	const cardContent = (
		<Card
			variant="default"
			padding="sm"
			interactive
			onClick={onClick}
			className="group relative overflow-hidden aspect-[85.6/54] !rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
		>
			{hasGradient && (
				<div
					className="absolute -inset-4 blur-2xl pointer-events-none grayscale scale-110 opacity-30 dark:opacity-20 group-hover:grayscale-0 group-hover:scale-100 group-hover:opacity-100 dark:group-hover:opacity-60 transition-all duration-700 ease-out"
					style={blobGradient}
				/>
			)}
			<div
				className={`flex flex-col justify-between h-full relative ${hasGradient ? "dark:group-hover:text-white" : ""}`}
			>
				<HStack justify="between" align="start">
					<Caption
						className={hasGradient ? "dark:group-hover:text-white/60" : ""}
					>
						{account.bank}
					</Caption>
					<Muted
						size="xs"
						className={hasGradient ? "dark:group-hover:text-white/50" : ""}
					>
						{getAccountTypeName(account.type)}
					</Muted>
				</HStack>
				<VStack spacing="xs" align="start">
					{isEditingAnchor ? (
						<div
							className="flex items-baseline"
							onClick={(e) => e.stopPropagation()}
						>
							<span className="text-lg font-bold">
								{account.mainCurrency &&
									new Intl.NumberFormat("en-US", {
										style: "currency",
										currency: account.mainCurrency,
									})
										.formatToParts(0)
										.find((p) => p.type === "currency")?.value}
							</span>
							<input
								ref={anchorInputRef}
								type="text"
								inputMode="decimal"
								value={anchorInput}
								onChange={(e) => setAnchorInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleSaveAnchor();
									}
									if (e.key === "Escape") handleCancelAnchorEdit();
								}}
								onBlur={() => {
									if (!anchorCancelledRef.current) handleSaveAnchor();
								}}
								disabled={isSavingAnchor}
								className="text-lg font-bold bg-transparent outline-none border-b border-current w-24 dark:group-hover:text-white"
							/>
						</div>
					) : (
						<Text
							weight="semibold"
							size="lg"
							className={hasGradient ? "dark:group-hover:text-white" : ""}
						>
							{formatBalance(account.balance)}
						</Text>
					)}
					<Text
						size="sm"
						className={hasGradient ? "dark:group-hover:text-white/70" : ""}
					>
						{account.friendlyName || account.name}
					</Text>
				</VStack>
			</div>
		</Card>
	);

	if (onEdit || onDelete || onSaveAnchor || onMerge) {
		return (
			<ContextMenu>
				<ContextMenuTrigger asChild>{cardContent}</ContextMenuTrigger>
				<ContextMenuContent>
					{onEdit && (
						<ContextMenuItem onClick={() => onEdit(account)}>
							<Pencil className="mr-2 h-4 w-4" />
							Edit
						</ContextMenuItem>
					)}
					{onSaveAnchor && (
						<ContextMenuItem onClick={handleStartAnchorEdit}>
							<Anchor className="mr-2 h-4 w-4" />
							Set Anchor Balance
						</ContextMenuItem>
					)}
					{onMerge && (
						<ContextMenuItem onClick={() => onMerge(account)}>
							<Merge className="mr-2 h-4 w-4" />
							Merge into...
						</ContextMenuItem>
					)}
					{onDelete && (
						<ContextMenuItem
							onClick={() => onDelete(account)}
							className="text-destructive"
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</ContextMenuItem>
					)}
				</ContextMenuContent>
			</ContextMenu>
		);
	}

	return cardContent;
}
