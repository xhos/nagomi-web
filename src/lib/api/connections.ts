import { create } from "@bufbuild/protobuf";
import {
	CreateConnectionRequestSchema,
	DeleteConnectionRequestSchema,
	ListConnectionsRequestSchema,
	SetSyncIntervalRequestSchema,
	TriggerSyncRequestSchema,
} from "@/gen/nagomi/v1/connection_services_pb";
import { connectionsClient } from "@/lib/grpc-client";

export interface CreateConnectionInput {
	provider: string;
	credentials: string;
	syncIntervalMinutes?: number;
}

export const connectionsApi = {
	async list() {
		const request = create(ListConnectionsRequestSchema, {});
		const response = await connectionsClient.listConnections(request);
		return response.connections;
	},

	async create(data: CreateConnectionInput) {
		const request = create(CreateConnectionRequestSchema, {
			provider: data.provider,
			credentials: data.credentials,
			syncIntervalMinutes: data.syncIntervalMinutes,
		});
		const response = await connectionsClient.createConnection(request);
		return response.id;
	},

	async delete(id: bigint) {
		const request = create(DeleteConnectionRequestSchema, { id });
		await connectionsClient.deleteConnection(request);
	},

	async triggerSync(id: bigint) {
		const request = create(TriggerSyncRequestSchema, { id });
		await connectionsClient.triggerSync(request);
	},

	async setSyncInterval(id: bigint, syncIntervalMinutes: number | undefined) {
		const request = create(SetSyncIntervalRequestSchema, {
			id,
			syncIntervalMinutes,
		});
		await connectionsClient.setSyncInterval(request);
	},
};
