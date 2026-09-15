"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormError, NativeSelect } from "@/components/ui/forms";
import { Input } from "@/components/ui/input";
import { useCreateConnection } from "@/hooks/useConnections";
import {
	INTERVAL_OPTIONS,
	type Provider,
	parseIntervalValue,
} from "../providers";

interface ConnectProviderDialogProps {
	provider: Provider | null;
	onOpenChange: (open: boolean) => void;
}

export function ConnectProviderDialog({
	provider,
	onOpenChange,
}: ConnectProviderDialogProps) {
	const open = !!provider;
	const [values, setValues] = useState<Record<string, string>>({});
	const [intervalValue, setIntervalValue] = useState<string>("1440");
	const { createConnectionAsync, isPending, error, reset } =
		useCreateConnection();

	useEffect(() => {
		if (open) {
			setValues({});
			setIntervalValue("1440");
			reset();
		}
	}, [open, reset]);

	if (!provider) return null;

	const errorMessage = error instanceof Error ? error.message : null;
	const allFilled = provider.fields.every((f) => values[f.key]?.trim());

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!allFilled) return;
		await createConnectionAsync({
			provider: provider.slug,
			credentials: JSON.stringify(values),
			syncIntervalMinutes: parseIntervalValue(intervalValue),
		});
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>connect {provider.label}</DialogTitle>
					<DialogDescription>{provider.description}</DialogDescription>
				</DialogHeader>
				<form onSubmit={onSubmit} className="space-y-4">
					{provider.fields.map((field) => (
						<Field
							key={field.key}
							label={field.label}
							htmlFor={`conn-${field.key}`}
						>
							<Input
								id={`conn-${field.key}`}
								type={field.type ?? "text"}
								autoComplete="off"
								value={values[field.key] ?? ""}
								onChange={(e) => {
									setValues((prev) => ({
										...prev,
										[field.key]: e.target.value,
									}));
									if (error) reset();
								}}
								placeholder={field.placeholder}
								disabled={isPending}
								aria-invalid={!!errorMessage}
							/>
						</Field>
					))}

					<Field label="Sync every" htmlFor="conn-interval">
						<NativeSelect
							id="conn-interval"
							value={intervalValue}
							onChange={(e) => setIntervalValue(e.target.value)}
							disabled={isPending}
						>
							{INTERVAL_OPTIONS.map((o) => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</NativeSelect>
					</Field>

					<FormError>{errorMessage}</FormError>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isPending || !allFilled}>
							{isPending ? "Connecting…" : "Connect"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
