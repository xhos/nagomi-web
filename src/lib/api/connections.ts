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
	async list(userId: string) {
		const request = create(ListConnectionsRequestSchema, { userId });
		const response = await connectionsClient.listConnections(request);
		return response.connections;
	},

	async create(userId: string, data: CreateConnectionInput) {
		const request = create(CreateConnectionRequestSchema, {
			userId,
			provider: data.provider,
			credentials: data.credentials,
			syncIntervalMinutes: data.syncIntervalMinutes,
		});
		const response = await connectionsClient.createConnection(request);
		return response.id;
	},

	async delete(userId: string, id: bigint) {
		const request = create(DeleteConnectionRequestSchema, { userId, id });
		await connectionsClient.deleteConnection(request);
	},

	async triggerSync(userId: string, id: bigint) {
		const request = create(TriggerSyncRequestSchema, { userId, id });
		await connectionsClient.triggerSync(request);
	},

	async setSyncInterval(
		userId: string,
		id: bigint,
		syncIntervalMinutes: number | undefined,
	) {
		const request = create(SetSyncIntervalRequestSchema, {
			userId,
			id,
			syncIntervalMinutes,
		});
		await connectionsClient.setSyncInterval(request);
	},
};
