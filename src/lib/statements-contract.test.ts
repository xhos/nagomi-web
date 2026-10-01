import assert from "node:assert/strict";
import { test } from "node:test";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { DateSchema } from "@/gen/google/type/date_pb";
import { UpdateAccountRequestSchema } from "@/gen/nagomi/v1/account_services_pb";
import { AccountType } from "@/gen/nagomi/v1/enums_pb";
import { accountClient, statementClient } from "./demo/clients";
import { db, demoPdf } from "./demo/data";

const pdfNamed = (name: string) => demoPdf([name, String(Math.random())]);

test("statement settings are set, kept, and cleared through the update mask like core", async () => {
	const acct = db.accounts.find((a) => a.statementDriven);
	assert.ok(acct);
	const update = (
		init: Parameters<typeof create<typeof UpdateAccountRequestSchema>>[1],
	) =>
		accountClient.updateAccount(
			create(UpdateAccountRequestSchema, {
				userId: "demo",
				id: acct.id,
				...init,
			}),
		);

	await update({
		updateMask: { paths: ["statements_start", "statement_release_day"] },
		statementsStart: create(DateSchema, { year: 2025, month: 1, day: 1 }),
		statementReleaseDay: 16,
	});
	assert.equal(acct.statementsStart?.year, 2025);
	assert.equal(acct.statementReleaseDay, 16);

	// not masked: left alone
	await update({ updateMask: { paths: ["name"] }, name: acct.name });
	assert.equal(acct.statementReleaseDay, 16);

	// masked and unset: cleared
	await update({
		updateMask: { paths: ["statements_start", "statement_release_day"] },
	});
	assert.equal(acct.statementsStart, undefined);
	assert.equal(acct.statementReleaseDay, undefined);

	await assert.rejects(
		update({
			updateMask: { paths: ["statement_release_day"] },
			statementReleaseDay: 32,
		}),
		(e) => ConnectError.from(e).code === Code.InvalidArgument,
	);
});

test("statements import only into statement-driven accounts, and new ones are statement-driven", async () => {
	const plain = db.accounts.find(
		(a) => !a.statementDriven && a.type === AccountType.ACCOUNT_SAVINGS,
	);
	assert.ok(plain);

	const preview = await statementClient.previewStatementImport({
		userId: "demo",
		pdfData: pdfNamed("visa"),
		fileName: "visa-statement.pdf",
	});
	const statementId = preview.statement?.id;
	assert.ok(statementId);

	await assert.rejects(
		statementClient.commitStatementImport({
			userId: "demo",
			statementId,
			account: { case: "accountId", value: plain.id },
		}),
		(e) => ConnectError.from(e).code === Code.InvalidArgument,
	);

	const r = await statementClient.commitStatementImport({
		userId: "demo",
		statementId,
		account: { case: "newAccountName", value: "new visa" },
	});
	const created = db.accounts.find((a) => a.id === r.statement?.accountId);
	assert.equal(created?.statementDriven, true);
});
