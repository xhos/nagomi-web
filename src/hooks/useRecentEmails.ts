import { useQuery } from "@tanstack/react-query";
import { emailsApi } from "@/lib/api/emails";
import { useUserId } from "./useSession";

// polled while mounted so a forwarding confirmation shows up without a reload
export function useRecentEmails() {
	const userId = useUserId();
	const {
		data: emails = [],
		isLoading,
		error,
	} = useQuery({
		queryKey: ["recent-emails", userId],
		queryFn: () => emailsApi.listRecent(userId as string),
		enabled: !!userId,
		refetchInterval: 10_000,
	});
	return { emails, isLoading, error };
}
