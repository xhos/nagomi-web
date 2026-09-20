import assert from "node:assert/strict";
import { test } from "node:test";
import { create, fromJson, toJson } from "@bufbuild/protobuf";
import { MoneySchema } from "@/gen/google/type/money_pb";
import { CursorSchema } from "@/gen/nagomi/v1/common_pb";
import { ReceiptSchema, ReceiptStatus } from "@/gen/nagomi/v1/receipt_pb";
import { UpdateTransactionRequestSchema } from "@/gen/nagomi/v1/transaction_services_pb";
import {
	dashboardClient,
	receiptClient,
	transactionClient,
} from "./demo/clients";
import { db, money, nextId } from "./demo/data";
import { comparisonMonths, nextOccurrence } from "./overview-history";
import { collectPages } from "./pagination";
import { reportingAmount } from "./reporting";

test("comparisons exclude missing history and the first partial import month", () => {
	const month = new Date(2026, 8, 1);
	assert.equal(comparisonMonths(month, 3, []).length, 0);
	assert.equal(comparisonMonths(month, 3, [new Date(2026, 8, 3)]).length, 0);
	assert.equal(comparisonMonths(month, 3, [new Date(2026, 6, 15)]).length, 1);
	assert.equal(comparisonMonths(month, 3, [new Date(2026, 5, 1)]).length, 3);
});

test("upcoming payments do not roll cancelled patterns into the future", () => {
	const today = new Date(2026, 8, 15);
	assert.equal(
		nextOccurrence(new Date(2026, 6, 10), true, 30, today),
		undefined,
	);
	assert.equal(
		nextOccurrence(new Date(2026, 7, 15, 15), true, 30, today)?.getDate(),
		15,
	);
	assert.equal(
		nextOccurrence(new Date(2026, 8, 8), false, 7, today)?.getDate(),
		15,
	);
});

test("reporting converts account currencies to CAD and rejects missing rates", () => {
	const cad = create(MoneySchema, { currencyCode: "CAD", units: BigInt(100) });
	const usd = create(MoneySchema, { currencyCode: "USD", units: BigInt(100) });
	assert.equal(
		reportingAmount(cad, {}) + reportingAmount(usd, { USD: 1.36 }),
		236,
	);
	assert.equal(reportingAmount(money(-12345, "USD"), { USD: 1.36 }), -167.89);
	assert.throws(() => reportingAmount(usd, {}), /exchange rate/);
});

test("pagination reads beyond 40 pages and rejects a repeated cursor", async () => {
	let page = 0;
	const all = await collectPages(async () => {
		page++;
		return {
			transactions: [page],
			hasMore: page < 42,
			nextCursor: create(CursorSchema, {
				id: BigInt(page),
				date: { seconds: BigInt(page) },
			}),
		};
	});
	assert.equal(all.length, 42);
	await assert.rejects(
		collectPages(async () => ({
			transactions: [1],
			hasMore: true,
			nextCursor: create(CursorSchema, {
				id: BigInt(1),
				date: { seconds: BigInt(1) },
			}),
		})),
		/did not advance/,
	);
});

test("demo keeps total count independent of pagination and honors wire-format category clearing", async () => {
	const first = await transactionClient.listTransactions({
		limit: 1,
		uncategorized: true,
	});
	assert.ok(first.totalCount > BigInt(1));
	const second = await transactionClient.listTransactions({
		limit: 1,
		uncategorized: true,
		cursor: first.nextCursor,
	});
	assert.equal(first.totalCount, second.totalCount);
	const tx = db.transactions.find((t) => t.categoryId !== undefined);
	assert.ok(tx);
	const category = tx.categoryId;
	await transactionClient.updateTransaction({
		id: tx.id,
		updateMask: { paths: ["user_notes"] },
		userNotes: "test",
	});
	assert.equal(tx.categoryId, category);
	const request = create(UpdateTransactionRequestSchema, {
		id: tx.id,
		updateMask: { paths: ["category_id"] },
	});
	await transactionClient.updateTransaction(
		fromJson(
			UpdateTransactionRequestSchema,
			toJson(UpdateTransactionRequestSchema, request),
		),
	);
	assert.equal(tx.categoryId, undefined);
	assert.equal(tx.categoryManuallySet, true);
});

test("receipt pagination and unlinked counts include results beyond the first 50", async () => {
	for (let i = 0; i < 55; i++)
		db.receipts.push(
			create(ReceiptSchema, {
				id: nextId(),
				status: ReceiptStatus.PARSED,
				currency: "JPY",
				total: money(100, "JPY"),
			}),
		);
	const first = await receiptClient.listReceipts({
		currency: "JPY",
		limit: 50,
		unlinkedOnly: true,
	});
	const second = await receiptClient.listReceipts({
		currency: "JPY",
		limit: 50,
		offset: 50,
		unlinkedOnly: true,
	});
	assert.equal(first.totalCount, BigInt(55));
	assert.equal(first.receipts.length, 50);
	assert.equal(second.receipts.length, 5);
	const count = await receiptClient.listReceipts({
		currency: "JPY",
		limit: 1,
		status: ReceiptStatus.PARSED,
		unlinkedOnly: true,
	});
	assert.equal(count.totalCount, BigInt(55));
});

test("demo reporting rates have the same direction as the core API", async () => {
	const response = await dashboardClient.getExchangeRates({
		reportingCurrency: "CAD",
		currencies: ["CAD", "USD"],
	});
	assert.equal(response.rates.CAD, 1);
	assert.equal(response.rates.USD, 1.36);
});
