import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { AccountService } from "@/gen/nagomi/v1/account_services_pb";
import { CategoryService } from "@/gen/nagomi/v1/category_services_pb";
import { ConnectionsService } from "@/gen/nagomi/v1/connection_services_pb";
import { DashboardService } from "@/gen/nagomi/v1/dashboard_services_pb";
import { ReceiptService } from "@/gen/nagomi/v1/receipt_services_pb";
import { RuleService } from "@/gen/nagomi/v1/rule_services_pb";
import { TransactionService } from "@/gen/nagomi/v1/transaction_services_pb";

const gatewayUrl =
	process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:55550";

const transport = createConnectTransport({
	baseUrl: `${gatewayUrl}/api`,
	useBinaryFormat: false,
	fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
	interceptors: [],
});

export const accountClient = createClient(AccountService, transport);
export const transactionClient = createClient(TransactionService, transport);
export const categoryClient = createClient(CategoryService, transport);
export const ruleClient = createClient(RuleService, transport);
export const dashboardClient = createClient(DashboardService, transport);
export const receiptClient = createClient(ReceiptService, transport);
export const connectionsClient = createClient(ConnectionsService, transport);
