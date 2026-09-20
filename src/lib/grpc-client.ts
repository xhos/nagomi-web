import { createClient, type Transport } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { AccountService } from "@/gen/nagomi/v1/account_services_pb";
import { CategoryService } from "@/gen/nagomi/v1/category_services_pb";
import { ConnectionsService } from "@/gen/nagomi/v1/connection_services_pb";
import { DashboardService } from "@/gen/nagomi/v1/dashboard_services_pb";
import { ReceiptService } from "@/gen/nagomi/v1/receipt_services_pb";
import { RuleService } from "@/gen/nagomi/v1/rule_services_pb";
import { TransactionService } from "@/gen/nagomi/v1/transaction_services_pb";
import { DEMO } from "@/lib/demo";
import * as demo from "@/lib/demo/clients";
import { gatewayUrl } from "@/lib/gateway-url";

// NEXT_PUBLIC_DEMO=1 swaps every client for an in-memory fake; the real transport is never built
const transport = DEMO
	? null
	: createConnectTransport({
			baseUrl: `${gatewayUrl()}/api`,
			useBinaryFormat: false,
			fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
			interceptors: [],
		});

export const accountClient = DEMO
	? demo.accountClient
	: createClient(AccountService, transport as Transport);
export const transactionClient = DEMO
	? demo.transactionClient
	: createClient(TransactionService, transport as Transport);
export const categoryClient = DEMO
	? demo.categoryClient
	: createClient(CategoryService, transport as Transport);
export const ruleClient = DEMO
	? demo.ruleClient
	: createClient(RuleService, transport as Transport);
export const dashboardClient = DEMO
	? demo.dashboardClient
	: createClient(DashboardService, transport as Transport);
export const receiptClient = DEMO
	? demo.receiptClient
	: createClient(ReceiptService, transport as Transport);
export const connectionsClient = DEMO
	? demo.connectionsClient
	: createClient(ConnectionsService, transport as Transport);
