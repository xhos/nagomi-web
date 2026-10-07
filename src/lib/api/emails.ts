import { create } from "@bufbuild/protobuf";
import { ListRecentEmailsRequestSchema } from "@/gen/nagomi/v1/email_services_pb";
import { emailClient } from "@/lib/grpc-client";

export const emailsApi = {
	async listRecent(userId: string) {
		const request = create(ListRecentEmailsRequestSchema, { userId });
		const response = await emailClient.listRecentEmails(request);
		return response.emails;
	},
};
