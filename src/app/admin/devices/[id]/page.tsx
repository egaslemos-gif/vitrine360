import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { getDeviceObservability } from "@/services/devices";
import { DeviceObservabilityPanel } from "@/features/devices/device-observability-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetadataRow } from "@/components/ui/metadata-row";

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminPage("manage_devices");
  if (!session) return <AccessDenied />;

  const { id } = await params;
  const result = await getDeviceObservability(id, session.tenantId);
  if (!result) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Ecrã não encontrado neste workspace.
        </p>
        <Link
          href="/admin/devices"
          className="text-sm text-[var(--color-primary)] underline"
        >
          Voltar à lista
        </Link>
      </div>
    );
  }

  const { device, observability } = result;
  const presence = observability.presence?.status ?? "OFFLINE";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-1">
        <Link
          href="/admin/devices"
          className="text-xs text-[var(--color-muted-foreground)] underline"
        >
          ← Devices
        </Link>
        <PageHeader
          title={device.name ?? "Ecrã"}
          description="Detalhe operacional — identificação, estado e diagnóstico"
          actions={<StatusBadge status={presence} />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identificação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <MetadataRow label="Nome">{device.name ?? "—"}</MetadataRow>
          <MetadataRow label="Código">{device.deviceCode ?? "—"}</MetadataRow>
          <MetadataRow label="Tipo">{device.displayType}</MetadataRow>
          <MetadataRow label="Local">{device.location ?? "—"}</MetadataRow>
          <MetadataRow label="Device ID">
            <span className="font-mono text-xs break-all">{device.id}</span>
          </MetadataRow>
          <MetadataRow label="Interacção">{device.interactionMode}</MetadataRow>
          <MetadataRow label="Orientação">{device.orientation}</MetadataRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado & Runtime</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-[var(--color-muted-foreground)]">
            Presence, playback, sync, network, browser e policy — nível
            operacional e técnico.
          </p>
          <DeviceObservabilityPanel obs={observability} />
        </CardContent>
      </Card>
    </div>
  );
}
