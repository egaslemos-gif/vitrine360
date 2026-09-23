import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import {
  createSchedule,
  createScheduleSchema,
  listSchedules,
} from "@/services/schedules";

export async function GET() {
  try {
    const session = await requireSession("manage_schedules");
    const items = await listSchedules(session.tenantId);
    return jsonOk({ schedules: items });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession("manage_schedules");
    const body = createScheduleSchema.parse(await req.json());
    const id = await createSchedule(body, session.tenantId, session.id);
    return jsonOk({ id });
  } catch (e) {
    return handleApiError(e);
  }
}
