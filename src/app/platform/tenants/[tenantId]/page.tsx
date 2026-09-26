import { requirePlatformPage } from "@/lib/platform-access";
import {
  PlatformAccessDenied,
  PlatformDisabled,
} from "@/components/platform-gate-states";
import { PlatformTenantDetail } from "@/features/platform/platform-tenant-detail";

type PageProps = { params: Promise<{ tenantId: string }> };

export default async function PlatformTenantDetailPage({ params }: PageProps) {
  const gate = await requirePlatformPage("platform.tenants.read");
  if (gate.kind === "disabled") return <PlatformDisabled />;
  if (gate.kind === "forbidden") return <PlatformAccessDenied />;

  const { tenantId } = await params;
  return <PlatformTenantDetail tenantId={tenantId} />;
}
