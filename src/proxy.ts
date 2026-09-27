/**
 * RUNTIME-EXPERIENCE-05 — Dedicated Experience Origin host guard.
 * + Smart TV home rewrite (Sraf cannot paint Tailwind v4 marketing CSS).
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
import { isFragileSmartTvUserAgent } from "@/lib/fragile-smart-tv";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent");

  // Marketing homepage uses Tailwind v4 / modern CSS that Sraf cannot parse.
  // Serve a static lite home (same pattern as /tv.html for the player).
  if (
    (pathname === "/" || pathname === "") &&
    isFragileSmartTvUserAgent(ua)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/home-lite.html";
    return NextResponse.rewrite(url);
  }

  const config = parseExperienceOriginConfig({
    EXPERIENCE_ORIGIN: process.env.EXPERIENCE_ORIGIN,
    EXPERIENCE_ORIGIN_HOSTS: process.env.EXPERIENCE_ORIGIN_HOSTS,
  });

  if (!isExperienceOriginHost(request.headers.get("host"), config)) {
    return NextResponse.next();
  }

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
