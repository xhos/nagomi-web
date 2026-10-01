import { create } from "@bufbuild/protobuf";
import { DateSchema, type Date as ProtoDate } from "@/gen/google/type/date_pb";

// a calendar day, as a local midnight
export const fromProtoDate = (d?: ProtoDate) =>
	d ? new Date(d.year, d.month - 1, d.day) : null;

// <input type="date"> values ("2024-07-12") to and from calendar days
export function protoDateToInput(d?: ProtoDate) {
	if (!d) return "";
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
}

export function inputToProtoDate(value: string) {
	const [year, month, day] = value.split("-").map(Number);
	if (!year || !month || !day) return undefined;
	return create(DateSchema, { year, month, day });
}
