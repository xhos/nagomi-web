"use client";

import { Search, SlidersHorizontal, Upload } from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	PageContainer,
	PageContent,
	PageHeaderWithTitle,
} from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import type { Receipt } from "@/gen/nagomi/v1/receipt_pb";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
	type ReceiptFilters,
	useReceipt,
	useReceipts,
} from "@/hooks/useReceipts";
import { cn } from "@/lib/utils";
import { ReceiptDetailDialog } from "./components/ReceiptDetailDialog";
import {
	countActiveReceiptFilters,
	ReceiptFiltersPanel,
} from "./components/ReceiptFilters";
import { ReceiptRow } from "./components/ReceiptRow";
import { UploadReceiptDialog } from "./components/UploadReceiptDialog";

export default function ReceiptsPage() {
	const [uploadOpen, setUploadOpen] = useState(false);
	const [duplicateId, setDuplicateId] = useState<bigint | null>(null);
	const [searchInput, setSearchInput] = useState("");
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [filters, setFilters] = useState<ReceiptFilters>({});
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [deleting, setDeleting] = useState<Receipt | null>(null);
	const query = useDebouncedValue(searchInput, 300);
	const active = countActiveReceiptFilters(filters);

	const {
		receipts,
		isLoading,
		error,
		deleteReceipt,
		isDeleting,
		retryParse,
		hasMore,
		loadMore,
		isLoadingMore,
	} = useReceipts({
		...filters,
		query: query || undefined,
	});
	const duplicate = useReceipt(duplicateId);

	return (
		<PageContainer>
			<PageContent>
				<PageHeaderWithTitle
					title="receipts"
					actions={
						<>
							<div className="relative">
								<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search"
									aria-label="Search receipts"
									className="w-40 pl-8 sm:w-56"
									value={searchInput}
									onChange={(e) => setSearchInput(e.target.value)}
								/>
							</div>
							<Button
								variant="outline"
								onClick={() => setFiltersOpen((o) => !o)}
								aria-expanded={filtersOpen}
								className={cn(filtersOpen && "bg-muted")}
							>
								<SlidersHorizontal />
								Filters
								{active > 0 && (
									<span className="rounded-md bg-foreground px-1.5 text-xs text-background tabular-nums">
										{active}
									</span>
								)}
							</Button>
							<Button onClick={() => setUploadOpen(true)}>
								<Upload />
								Upload
							</Button>
						</>
					}
				/>

				{filtersOpen && (
					<ReceiptFiltersPanel filters={filters} onFiltersChange={setFilters} />
				)}

				{error && (
					<p className="mb-4 text-sm text-destructive">
						Couldn't load receipts: {error.message}
					</p>
				)}

				{isLoading ? (
					<div className="divide-y">
						{[0, 1, 2, 3].map((i) => (
							<div key={i} className="flex justify-between py-2">
								<div className="space-y-2">
									<Skeleton className="h-4 w-40" />
									<Skeleton className="h-3 w-56" />
								</div>
								<Skeleton className="h-4 w-20" />
							</div>
						))}
					</div>
				) : receipts.length === 0 ? (
					<EmptyState
						text={query || active ? "No receipts match." : "No receipts yet."}
						action={query || active ? undefined : "Upload a receipt"}
						onAction={() => setUploadOpen(true)}
					/>
				) : (
					<div className="divide-y border-t">
						{receipts.map((r) => (
							<ReceiptRow
								key={r.id.toString()}
								receipt={r}
								expanded={expandedId === r.id.toString()}
								onToggle={() =>
									setExpandedId((cur) =>
										cur === r.id.toString() ? null : r.id.toString(),
									)
								}
								onRetry={() => retryParse(r.id)}
								onDelete={() => setDeleting(r)}
							/>
						))}
					</div>
				)}

				{hasMore && (
					<Button
						variant="outline"
						className="mt-4"
						disabled={isLoadingMore}
						onClick={() => loadMore()}
					>
						{isLoadingMore ? "Loading…" : "Load more"}
					</Button>
				)}

				<UploadReceiptDialog
					open={uploadOpen}
					onOpenChange={setUploadOpen}
					onUploadComplete={() => setUploadOpen(false)}
					onDuplicate={setDuplicateId}
				/>

				<ReceiptDetailDialog
					receipt={duplicate.data?.receipt ?? null}
					linkCandidates={duplicate.data?.linkCandidates}
					open={duplicateId !== null}
					onOpenChange={(o) => !o && setDuplicateId(null)}
					isLoading={duplicate.isLoading}
				/>

				<AlertDialog
					open={!!deleting}
					onOpenChange={(o) => !o && setDeleting(null)}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete this receipt?</AlertDialogTitle>
							<AlertDialogDescription>
								{deleting?.merchant
									? `The receipt from ${deleting.merchant} `
									: "It "}
								will be removed. Linked transactions stay.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={isDeleting}>
								Cancel
							</AlertDialogCancel>
							<AlertDialogAction
								disabled={isDeleting}
								onClick={() => {
									if (deleting) deleteReceipt(deleting.id);
									setDeleting(null);
								}}
							>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</PageContent>
		</PageContainer>
	);
}
