import { format } from "date-fns";
import type { Date as ProtoDate } from "@/gen/google/type/date_pb";
import { fromProtoDate } from "./date";

// "Mar 15 – Apr 14, 2026", with the start's year only when it differs
export function periodLabel(start?: ProtoDate, end?: ProtoDate) {
	const from = fromProtoDate(start);
	const to = fromProtoDate(end);
	if (!from || !to) return null;
	const sameYear = from.getFullYear() === to.getFullYear();
	return `${format(from, sameYear ? "MMM d" : "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
}
