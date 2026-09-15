"use client";

import { format } from "date-fns";
import { Ellipsis, Merge, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { DetailRow, ListRow, RowMenuButton } from "@/components/ui/list";
import type { Account } from "@/gen/nagomi/v1/account_pb";
import { accountTypeName } from "@/lib/utils/account";
import { formatAmount } from "@/lib/utils/transaction";

interface AccountRowProps {
	account: Account;
	expanded: boolean;
	onToggle: () => void;
	onEdit: () => void;
	onMerge?: () => void;
	onDelete: () => void;
	onSetAnchor: (amount: number) => Promise<void>;
}

const stamp = (t?: { seconds?: bigint }) =>
	t?.seconds ? format(new Date(Number(t.seconds) * 1000), "MMM d, yyyy") : null;

export function AccountRow({
	account,
	expanded,
	onToggle,
	onEdit,
	onMerge,
	onDelete,
	onSetAnchor,
}: AccountRowProps) {
	const [anchorEditing, setAnchorEditing] = useState(false);
	const [anchorInput, setAnchorInput] = useState("");
	const [anchorError, setAnchorError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const name = account.friendlyName || account.name;
	const balance = formatAmount(account.balance);

	const startAnchor = () => {
		setAnchorInput(balance.toFixed(2));
		setAnchorError(null);
		setAnchorEditing(true);
	};
	const saveAnchor = async () => {
		const n = Number(anchorInput);
		if (!Number.isFinite(n)) {
			setAnchorError("Enter a number");
			return;
		}
		setSaving(true);
		try {
			await onSetAnchor(n);
			setAnchorEditing(false);
		} catch (e) {
			setAnchorError(e instanceof Error ? e.message : "Couldn't save");
		} finally {
			setSaving(false);
		}
	};

	const actions = (
		Item: typeof ContextMenuItem,
		Separator: typeof ContextMenuSeparator,
	) => (
		<>
			<Item onClick={onEdit}>
				<Pencil /> Edit
			</Item>
			{onMerge && (
				<Item onClick={onMerge}>
					<Merge /> Merge into…
				</Item>
			)}
			<Separator />
			<Item variant="destructive" onClick={onDelete}>
				<Trash2 /> Delete
			</Item>
		</>
	);

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<ListRow expanded={expanded} onClick={onToggle}>
					<div className="flex items-start gap-3">
						<div className="min-w-0 flex-1">
							<div className="truncate font-medium">{name}</div>
							<div className="truncate text-sm text-muted-foreground">
								{[
									account.bank.toLowerCase() === accountTypeName(account.type)
										? null
										: account.bank,
									accountTypeName(account.type),
									account.friendlyName ? account.name : null,
								]
									.filter(Boolean)
									.join(" · ")}
							</div>
						</div>
						<Amount
							value={balance}
							currency={account.mainCurrency}
							className="shrink-0 font-medium"
						/>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<RowMenuButton
									aria-label="Actions"
									onClick={(e) => e.stopPropagation()}
								>
									<Ellipsis className="size-4" />
								</RowMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								onClick={(e) => e.stopPropagation()}
							>
								{actions(DropdownMenuItem, DropdownMenuSeparator)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					{expanded && (
						<div
							className="mt-3 border-t pt-3"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="grid gap-x-8 sm:grid-cols-2">
								<div>
									<DetailRow label="Name">{account.name}</DetailRow>
									<DetailRow label="Display name">
										{account.friendlyName || "—"}
									</DetailRow>
									<DetailRow label="Bank">{account.bank}</DetailRow>
									<DetailRow label="Type">
										{accountTypeName(account.type)}
									</DetailRow>
									<DetailRow label="Currency">{account.mainCurrency}</DetailRow>
									<DetailRow label="Aliases">
										{account.aliases.filter((a) => a !== account.name).length
											? account.aliases
													.filter((a) => a !== account.name)
													.join(", ")
											: "—"}
									</DetailRow>
								</div>
								<div>
									<DetailRow label="Balance">
										<Amount value={balance} currency={account.mainCurrency} />
									</DetailRow>
									<DetailRow label="Anchor">
										{anchorEditing ? (
											<span className="flex flex-wrap items-center gap-2">
												<Input
													type="number"
													step="0.01"
													autoFocus
													value={anchorInput}
													onChange={(e) => setAnchorInput(e.target.value)}
													onKeyDown={(e) => {
														if (e.key === "Enter") saveAnchor();
														if (e.key === "Escape") setAnchorEditing(false);
													}}
													className="h-8 w-36"
												/>
												<Button
													size="sm"
													onClick={saveAnchor}
													disabled={saving}
												>
													Save
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => setAnchorEditing(false)}
												>
													Cancel
												</Button>
												{anchorError && (
													<span className="text-destructive">
														{anchorError}
													</span>
												)}
											</span>
										) : (
											<>
												{account.anchorBalance ? (
													<Amount
														value={formatAmount(account.anchorBalance)}
														currency={account.mainCurrency}
													/>
												) : (
													"—"
												)}
												{stamp(account.anchorDate) && (
													<span className="ml-2 text-muted-foreground">
														set {stamp(account.anchorDate)}
													</span>
												)}
												<Button
													variant="link"
													size="sm"
													className="ml-2 h-auto p-0"
													onClick={startAnchor}
												>
													Set to current balance
												</Button>
											</>
										)}
									</DetailRow>
									<DetailRow label="Colors">
										<span className="flex gap-1.5">
											{account.colors.map((c, i) => (
												<span
													key={`${c}-${i}`}
													className="size-4 rounded-full border"
													style={{ backgroundColor: c }}
												/>
											))}
										</span>
									</DetailRow>
									<DetailRow label="Created">
										{stamp(account.createdAt) ?? "—"}
									</DetailRow>
								</div>
							</div>
							<div className="mt-3 flex flex-wrap gap-2">
								<Button variant="outline" size="sm" onClick={onEdit}>
									Edit
								</Button>
								{onMerge && (
									<Button variant="outline" size="sm" onClick={onMerge}>
										Merge into…
									</Button>
								)}
								<Button
									variant="ghost"
									size="sm"
									className="ml-auto text-destructive hover:text-destructive"
									onClick={onDelete}
								>
									Delete
								</Button>
							</div>
						</div>
					)}
				</ListRow>
			</ContextMenuTrigger>
			<ContextMenuContent>
				{actions(ContextMenuItem, ContextMenuSeparator)}
			</ContextMenuContent>
		</ContextMenu>
	);
}
