import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { create } from "@bufbuild/protobuf";
import { TransactionSchema } from "@/gen/nagomi/v1/transaction_pb";
import { descriptionPattern, suggestRules } from "./demo/rules";

// same cases as core's rule_suggestions_test.go
describe("descriptionPattern", () => {
	const cases: [string, string][] = [
		["BO'S NO FRILLS 7952 TORONTO ON", "BO'S NO FRILLS"],
		["PAYPAL *STARBUCKSSF 4029357733 BC", "PAYPAL *STARBUCKSSF"],
		["ROGERS ******7679 888-764-3771 ON", "ROGERS"],
		["TIM HORTONS #6976 TORONTO ON", "TIM HORTONS"],
		["Fee Electronic transaction 1 @ $5.00", "Fee Electronic transaction"],
		["7-ELEVEN 1234 TORONTO", "7-ELEVEN"],
		["AMAZON* CM21W93Y3 VANCOUVER BC", "AMAZON*"],
		["  Payroll  Deposit OPS ", "Payroll  Deposit OPS"],
		["", ""],
	];
	for (const [input, want] of cases)
		test(input || "(empty)", () =>
			assert.equal(descriptionPattern(input), want),
		);
});

const tx = (description: string, n: number, categoryId?: bigint) =>
	Array.from({ length: n }, () =>
		create(TransactionSchema, { description, categoryId }),
	);

test("a broad pattern leaves common children alone", () => {
	const uncategorized = [
		...tx("PAYPAL *STARBUCKSSF 4029357733 BC", 6),
		...tx("PAYPAL *PROTON 4029357733 MI", 5),
		...tx("PAYPAL 4029357733", 2),
		...tx("PAYPAL *UPS 4029357733 NB", 1),
		...tx("METRO 759 TORONTO ON", 4),
		...tx("Alp*Shanghai Metro Shanghai", 1),
	];
	const got = Object.fromEntries(
		suggestRules(uncategorized, []).map((s) => [
			s.pattern,
			Number(s.transactionCount),
		]),
	);
	assert.deepEqual(got, {
		"PAYPAL *STARBUCKSSF": 6,
		"PAYPAL *PROTON": 5,
		METRO: 4,
		PAYPAL: 3,
	});
});

test("hints the category most similar transactions have", () => {
	const [s] = suggestRules(tx("SEVEN-ELEVEN TOKYO", 3), [
		...tx("SEVEN-ELEVEN TOKYO", 3, BigInt(7)),
		...tx("Seven-Eleven TOKYO", 1, BigInt(8)),
	]);
	assert.equal(s.categoryId, BigInt(7));
});
