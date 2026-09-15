"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/forms";
import { Input } from "@/components/ui/input";
import { type FieldName, NUMERIC_FIELDS, STRING_FIELDS } from "@/lib/rules";
import {
	FIELD_OPTIONS,
	NUMERIC_OPERATOR_OPTIONS,
	STRING_OPERATOR_OPTIONS,
	TX_DIRECTION_OPTIONS,
} from "./rule-dialog-constants";

export interface UICondition {
	field: FieldName;
	operator: string;
	value?: string | number;
	values?: string[];
	min_value?: number;
	max_value?: number;
	case_sensitive?: boolean;
	chips?: string[];
	currentInput?: string;
}

interface ConditionBuilderProps {
	condition: UICondition;
	showRemove: boolean;
	onUpdate: (updates: Partial<UICondition>) => void;
	onRemove: () => void;
}

const isString = (f: FieldName) => STRING_FIELDS.includes(f);
const isNumeric = (f: FieldName) => NUMERIC_FIELDS.includes(f);
const operatorsFor = (f: FieldName) =>
	isString(f) ? STRING_OPERATOR_OPTIONS : NUMERIC_OPERATOR_OPTIONS;

export function ConditionBuilder({
	condition,
	showRemove,
	onUpdate,
	onRemove,
}: ConditionBuilderProps) {
	const reset = {
		value: "",
		values: undefined,
		min_value: undefined,
		max_value: undefined,
		chips: [],
		currentInput: "",
	};
	const addChip = () => {
		const v = condition.currentInput?.trim();
		if (!v) return;
		const chips = [...(condition.chips ?? []), v];
		onUpdate({ chips, values: chips, currentInput: "" });
	};

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-2">
				<NativeSelect
					aria-label="Field"
					className="w-36"
					value={condition.field}
					onChange={(e) => {
						const field = e.target.value as FieldName;
						onUpdate({
							field,
							operator: operatorsFor(field)[0].value,
							case_sensitive: false,
							...reset,
						});
					}}
				>
					{FIELD_OPTIONS.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</NativeSelect>
				<NativeSelect
					aria-label="Operator"
					className="w-40"
					value={condition.operator}
					onChange={(e) => onUpdate({ operator: e.target.value, ...reset })}
				>
					{operatorsFor(condition.field).map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</NativeSelect>

				{condition.operator === "between" ? (
					<>
						<Input
							type="number"
							value={condition.min_value ?? ""}
							onChange={(e) =>
								onUpdate({
									min_value:
										e.target.value === "" ? undefined : Number(e.target.value),
								})
							}
							placeholder="Min"
							className="w-24"
						/>
						<span className="text-sm text-muted-foreground">and</span>
						<Input
							type="number"
							value={condition.max_value ?? ""}
							onChange={(e) =>
								onUpdate({
									max_value:
										e.target.value === "" ? undefined : Number(e.target.value),
								})
							}
							placeholder="Max"
							className="w-24"
						/>
					</>
				) : condition.field === "tx_direction" ? (
					<NativeSelect
						aria-label="Direction"
						className="w-36"
						value={condition.value?.toString() ?? ""}
						onChange={(e) => onUpdate({ value: Number(e.target.value) })}
					>
						<option value="">Choose</option>
						{TX_DIRECTION_OPTIONS.map((o) => (
							<option key={o.value} value={o.value}>
								{o.label}
							</option>
						))}
					</NativeSelect>
				) : isNumeric(condition.field) ? (
					<Input
						type="number"
						value={condition.value ?? ""}
						onChange={(e) =>
							onUpdate({
								value: e.target.value === "" ? "" : Number(e.target.value),
							})
						}
						placeholder="Amount"
						className="w-32"
					/>
				) : condition.operator === "contains_any" ? (
					<Input
						value={condition.currentInput ?? ""}
						onChange={(e) => onUpdate({ currentInput: e.target.value })}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								addChip();
							}
						}}
						onBlur={addChip}
						placeholder="Type a value, press Enter"
						className="w-56"
					/>
				) : (
					<Input
						value={(condition.value as string) ?? ""}
						onChange={(e) => onUpdate({ value: e.target.value })}
						placeholder="Value"
						className="w-56"
					/>
				)}

				{isString(condition.field) && condition.operator !== "regex" && (
					<label className="flex items-center gap-1.5 text-sm text-muted-foreground">
						<input
							type="checkbox"
							checked={!!condition.case_sensitive}
							onChange={(e) => onUpdate({ case_sensitive: e.target.checked })}
							className="size-3.5 accent-[var(--accent)]"
						/>
						Match case
					</label>
				)}

				{showRemove && (
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Remove condition"
						onClick={onRemove}
						className="ml-auto text-muted-foreground"
					>
						<X />
					</Button>
				)}
			</div>

			{!!condition.chips?.length && (
				<div className="flex flex-wrap gap-1.5">
					{condition.chips.map((chip, i) => (
						<span
							key={`${chip}-${i}`}
							className="flex h-7 items-center gap-1 rounded-md border pr-1 pl-2 text-sm"
						>
							{chip}
							<button
								type="button"
								aria-label={`Remove ${chip}`}
								onClick={() => {
									const chips = condition.chips?.filter((_, j) => j !== i);
									onUpdate({ chips, values: chips });
								}}
								className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
							>
								<X className="size-3" />
							</button>
						</span>
					))}
				</div>
			)}
		</div>
	);
}
