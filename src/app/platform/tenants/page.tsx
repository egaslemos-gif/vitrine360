import { requirePlatformPage } from "@/lib/platform-access";
import {
  PlatformAccessDenied,
  PlatformDisabled,
} from "@/components/platform-gate-states";
import { PlatformTenantsList } from "@/features/platform/platform-tenants-list";

export default async function PlatformTenantsPage() {
  const gate = await requirePlatformPage("platform.tenants.read");
  if (gate.kind === "disabled") return <PlatformDisabled />;
  if (gate.kind === "forbidden") return <PlatformAccessDenied />;

  return <PlatformTenantsList />;
}
