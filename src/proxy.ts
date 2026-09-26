/**
 * RUNTIME-EXPERIENCE-05 — Dedicated Experience Origin host guard.
 *
 * When the request Host matches EXPERIENCE_ORIGIN / EXPERIENCE_ORIGIN_HOSTS,
 * only `/x/*` package-serving paths are allowed. Privileged app routes are denied.
 *
 * Next.js 16: `proxy.ts` (not deprecated `middleware.ts`).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isAllowedPathOnExperienceOrigin,
  isExperienceOriginHost,
  parseExperienceOriginConfig,
} from "@/domain/experience-origin";

export function proxy(request: NextRequest) {
  const config = parseExperienceOriginConfig({
    EXPERIENCE_ORIGIN: process.env.EXPERIENCE_ORIGIN,
    EXPERIENCE_ORIGIN_HOSTS: process.env.EXPERIENCE_ORIGIN_HOSTS,
  });

  if (!isExperienceOriginHost(request.headers.get("host"), config)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (isAllowedPathOnExperienceOrigin(pathname)) {
    return NextResponse.next();
  }

  return new NextResponse("Not Found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Vitrine360-Experience-Origin": "denied-non-package-path",
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
