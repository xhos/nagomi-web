import { create } from "@bufbuild/protobuf";
import { useEffect, useState } from "react";
import type { Date as ProtoDate } from "@/gen/google/type/date_pb";
import { DateSchema } from "@/gen/google/type/date_pb";
import type { GetCategorySpendingComparisonResponse } from "@/gen/nagomi/v1/dashboard_services_pb";
import { PeriodType } from "@/gen/nagomi/v1/enums_pb";
import { dashboardApi } from "@/lib/api/dashboard";

export function useCategorySpending(
	userId: string,
	periodType: PeriodType,
	customDates?: { start: Date; end: Date },
) {
	const [data, setData] =
		useState<GetCategorySpendingComparisonResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		const fetchData = async () => {
			setLoading(true);
			setError(null);
			try {
				let customStartDate: ProtoDate | undefined;
				let customEndDate: ProtoDate | undefined;

				if (periodType === PeriodType.PERIOD_TYPE_CUSTOM && customDates) {
					customStartDate = create(DateSchema, {
						year: customDates.start.getFullYear(),
						month: customDates.start.getMonth() + 1,
						day: customDates.start.getDate(),
					});
					customEndDate = create(DateSchema, {
						year: customDates.end.getFullYear(),
						month: customDates.end.getMonth() + 1,
						day: customDates.end.getDate(),
					});
				}

				const response = await dashboardApi.getCategorySpendingComparison({
					userId,
					periodType,
					customStartDate,
					customEndDate,
				});
				setData(response);
			} catch (err) {
				setError(
					err instanceof Error ? err : new Error("Failed to fetch data"),
				);
			} finally {
				setLoading(false);
			}
		};

		if (periodType !== PeriodType.PERIOD_TYPE_CUSTOM || customDates) {
			fetchData();
		}
	}, [userId, periodType, customDates]);

	return { data, loading, error };
}
