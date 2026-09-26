/**
 * RUNTIME-EXPERIENCE-05 — Package member serving (bytes only).
 *
 * GET /x/{tenantId}/{experienceId}/{version}/[[...path]]
 *
 * Does not execute package JS/HTML on the server.
 * Does not create iframes or postMessage bridges.
 * Does not integrate with Player playback.
 */

import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api";
import {
  buildExperienceServeHeaders,
  resolveServeRequest,
} from "@/domain/experience-serving";
import { buildServeFrameAncestors } from "@/domain/experience-sandbox";
import { getStoredExperiencePackage } from "@/services/experience-package-store";

export const dynamic = "force-dynamic";

type Ctx = {
  params: Promise<{
    tenantId: string;
    experienceId: string;
    version: string;
    path?: string[];
  }>;
};

export async function GET(req: NextRequest, ctx: Ctx) {
  const limited = enforceRateLimit(req, "experience-serve", 600, 60_000);
  if (limited) return limited;

  const { tenantId, experienceId, version, path: pathParts } = await ctx.params;
  const assetPath = (pathParts ?? []).map(decodeURIComponent).join("/");

  const stored = getStoredExperiencePackage(
    decodeURIComponent(tenantId),
    decodeURIComponent(experienceId),
    decodeURIComponent(version),
  );

  const tid = decodeURIComponent(tenantId);
  const { isTenantOperable } = await import("@/services/tenant-lifecycle");
  if (!(await isTenantOperable(tid))) {
    return NextResponse.json(
      { error: "Not found", code: "TENANT_NOT_OPERABLE" },
      { status: 404 },
    );
  }

  const resolved = resolveServeRequest({
    tenantId: tid,
    experienceId: decodeURIComponent(experienceId),
    version: decodeURIComponent(version),
    assetPath,
    stored,
  });

  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.message, code: resolved.code },
      { status: resolved.status },
    );
  }

  const isDocument =
    resolved.contentType.startsWith("text/html") ||
    resolved.path.endsWith(".html") ||
    resolved.path.endsWith(".htm");

  const frameAncestors = buildServeFrameAncestors({
    appOrigin: process.env.NEXT_PUBLIC_APP_URL ?? null,
    includeSelf: true,
  });

  const headers = buildExperienceServeHeaders({
    contentType: resolved.contentType,
    packageSha256: resolved.packageSha256,
    isDocument,
    frameAncestors,
  });

  return new NextResponse(Buffer.from(resolved.bytes), {
    status: 200,
    headers,
  });
}
