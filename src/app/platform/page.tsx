import { redirect } from "next/navigation";
import { requirePlatformPage } from "@/lib/platform-access";
import {
  PlatformAccessDenied,
  PlatformDisabled,
} from "@/components/platform-gate-states";

/** Platform shell home → tenants list (only resource in PI-07). */
export default async function PlatformHomePage() {
  const gate = await requirePlatformPage("platform.tenants.read");
  if (gate.kind === "disabled") return <PlatformDisabled />;
  if (gate.kind === "forbidden") return <PlatformAccessDenied />;
  redirect("/platform/tenants");
}
