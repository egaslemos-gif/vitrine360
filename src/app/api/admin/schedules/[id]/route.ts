import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk, jsonError } from "@/lib/api";
import {
  deleteSchedule,
  getSchedule,
  setScheduleActive,
  updateSchedule,
  updateScheduleSchema,
} from "@/services/schedules";
import { z } from "zod";

const patchActiveSchema = z.object({
  active: z.boolean(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession("manage_schedules");
    const { id } = await params;
    const row = await getSchedule(id, session.tenantId);
    if (!row) return jsonError("Not found", 404);
    return jsonOk({ schedule: row });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession("manage_schedules");
    const { id } = await params;
    const json = await req.json();

    // Toggle active only
    if (
      json &&
      typeof json === "object" &&
      "active" in json &&
      !("name" in json) &&
      !("targets" in json)
    ) {
      const body = patchActiveSchema.parse(json);
      await setScheduleActive(id, body.active, session.tenantId, session.id);
      return jsonOk({ ok: true });
    }

    const body = updateScheduleSchema.parse(json);
    await updateSchedule(id, body, session.tenantId, session.id);
    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession("manage_schedules");
    const { id } = await params;
    await deleteSchedule(id, session.tenantId, session.id);
    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
