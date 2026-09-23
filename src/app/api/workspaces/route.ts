import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { listMemberships } from "@/services/memberships";

export async function GET() {
  try {
    const session = await requireSession();
    const rows = await listMemberships(session.id);
    return jsonOk({
      activeTenantId: session.activeTenantId,
      workspaces: rows
        .filter((row) => row.status === "ACTIVE")
        .map((row) => ({
          tenantId: row.tenantId,
          name: row.tenantName,
          slug: row.tenantSlug,
          role: row.role,
        })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
