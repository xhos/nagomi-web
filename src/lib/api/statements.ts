import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import {
	CommitStatementImportRequestSchema,
	DeleteStatementRequestSchema,
	GetStatementCoverageRequestSchema,
	GetStatementRequestSchema,
	ListStatementAlertsRequestSchema,
	ListStatementsRequestSchema,
	PlanStatementImportRequestSchema,
	PreviewStatementImportRequestSchema,
	ReparseStatementRequestSchema,
} from "@/gen/nagomi/v1/statement_services_pb";
import { statementClient } from "@/lib/grpc-client";

export type StatementTarget =
	| { accountId: bigint }
	| { newAccountName: string };

export const statementsApi = {
	async preview(userId: string, pdfData: Uint8Array, fileName: string) {
		const request = create(PreviewStatementImportRequestSchema, {
			userId,
			pdfData,
			fileName,
		});
		return statementClient.previewStatementImport(request);
	},

	// what committing into an account other than the matched one would do
	async plan(userId: string, statementId: bigint, accountId: bigint) {
		const request = create(PlanStatementImportRequestSchema, {
			userId,
			statementId,
			accountId,
		});
		const response = await statementClient.planStatementImport(request);
		if (!response.reconciliation) throw new Error("no reconciliation");
		return response.reconciliation;
	},

	async commit(userId: string, statementId: bigint, target: StatementTarget) {
		const request = create(CommitStatementImportRequestSchema, {
			userId,
			statementId,
			account:
				"accountId" in target
					? { case: "accountId", value: target.accountId }
					: { case: "newAccountName", value: target.newAccountName },
		});
		return statementClient.commitStatementImport(request);
	},

	async list(userId: string, accountId?: bigint) {
		const request = create(ListStatementsRequestSchema, { userId, accountId });
		const response = await statementClient.listStatements(request);
		return response.statements;
	},

	async get(userId: string, id: bigint) {
		const request = create(GetStatementRequestSchema, { userId, id });
		return statementClient.getStatement(request);
	},

	// a statement-driven account's periods, oldest first
	async coverage(userId: string, accountId: bigint) {
		const request = create(GetStatementCoverageRequestSchema, {
			userId,
			accountId,
		});
		const response = await statementClient.getStatementCoverage(request);
		return response.periods;
	},

	// missing, due and unbalanced periods across statement-driven accounts
	async alerts(userId: string) {
		const request = create(ListStatementAlertsRequestSchema, { userId });
		const response = await statementClient.listStatementAlerts(request);
		return response.alerts;
	},

	// runs the stored file through the parser again; only writes when applied
	async reparse(userId: string, id: bigint, apply: boolean) {
		const request = create(ReparseStatementRequestSchema, {
			userId,
			id,
			apply,
		});
		return statementClient.reparseStatement(request);
	},

	async delete(userId: string, id: bigint, deleteTransactions: boolean) {
		const request = create(DeleteStatementRequestSchema, {
			userId,
			id,
			deleteTransactions,
		});
		const response = await statementClient.deleteStatement(request);
		return response.deletedTransactions;
	},
};

export function isAlreadyImported(err: unknown) {
	return ConnectError.from(err).code === Code.AlreadyExists;
}

// core's validation messages read "Op: reason: validation failed"; keep the reason
export function statementErrorMessage(err: unknown, fallback: string) {
	const e = ConnectError.from(err);
	if (e.code !== Code.InvalidArgument) return fallback;
	const reason = e.rawMessage
		.replace(/: validation failed$/, "")
		.replace(/^StatementService\.\w+: /, "");
	return reason.charAt(0).toUpperCase() + reason.slice(1);
}
