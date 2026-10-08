import assert from "node:assert/strict";
import { test } from "node:test";
import { accountNumberMatches, parseRbcCsv, splitNew } from "./rbc-csv";

const HEADER =
	'"Account Type","Account Number","Transaction Date","Cheque Number","Description 1","Description 2","CAD$","USD$"\n';

test("reads rows, signed amounts and joined descriptions", () => {
	const parsed = parseRbcCsv(
		`${HEADER}Chequing,05172-5163878,6/15/2026,,"Transfer","WWW TRANSFER - 7908 ",100.00,,\n` +
			`Visa,4514093224914917,8/23/2026,,"LCBO/RAO #754 TORONTO ON",,-3.70,,\n` +
			`Visa,4514093224914917,8/24/2026,,"US SHOP",,,-1.25,\n`,
	);
	assert.ok(parsed);
	assert.equal(parsed.skipped, 0);
	assert.deepEqual(parsed.rows[0], {
		accountType: "Chequing",
		accountNumber: "05172-5163878",
		day: "2026-06-15",
		description: "Transfer WWW TRANSFER - 7908",
		currency: "CAD",
		cents: 10000,
	});
	assert.equal(parsed.rows[1].cents, -370);
	assert.equal(parsed.rows[2].currency, "USD");
});

test("rejects other csv files and counts unreadable rows", () => {
	assert.equal(parseRbcCsv("a,b\n1,2\n"), null);
	const parsed = parseRbcCsv(`${HEADER}Chequing,1,13/45/2026,,"X",,1.00,,\n`);
	assert.equal(parsed?.rows.length, 0);
	assert.equal(parsed?.skipped, 1);
});

test("account numbers match by their tail", () => {
	assert.ok(accountNumberMatches("05172-5163878", "5163878"));
	assert.ok(accountNumberMatches("4514093224914917", "4917") === true);
	assert.ok(!accountNumberMatches("05172-5163878", "5162458"));
	assert.ok(!accountNumberMatches("05172-5163878", "78"));
});

test("identical rows are real; each existing transaction cancels only one", () => {
	const rows = [
		{ day: "2026-06-15", cents: -50546 },
		{ day: "2026-06-15", cents: -50546 },
		{ day: "2026-06-17", cents: 111506 },
	];
	const one = splitNew(rows, [{ day: "2026-06-15", cents: -50546 }]);
	assert.equal(one.duplicates.length, 1);
	assert.equal(one.fresh.length, 2);
	const all = splitNew(rows, [
		{ day: "2026-06-15", cents: -50546 },
		{ day: "2026-06-15", cents: -50546 },
		{ day: "2026-06-18", cents: 111506 },
	]);
	assert.equal(all.fresh.length, 0);
	assert.equal(splitNew(rows, []).fresh.length, 3);
});

test("a neighbouring day pairs, a far day or opposite sign does not", () => {
	const row = [{ day: "2026-06-15", cents: -1000 }];
	assert.equal(
		splitNew(row, [{ day: "2026-06-16", cents: -1000 }]).fresh.length,
		0,
	);
	assert.equal(
		splitNew(row, [{ day: "2026-06-18", cents: -1000 }]).fresh.length,
		1,
	);
	assert.equal(
		splitNew(row, [{ day: "2026-06-15", cents: 1000 }]).fresh.length,
		1,
	);
});
