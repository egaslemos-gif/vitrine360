import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { getDeviceObservability } from "@/services/devices";
import { DeviceObservabilityPanel } from "@/features/devices/device-observability-panel";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
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
      <div className="space-y-4">
        <p className="ui-secondary">Ecrã não encontrado neste workspace.</p>
        <Link href="/admin/devices" className="ui-secondary text-[var(--color-primary)] underline">
          Voltar à lista
        </Link>
      </div>
    );
  }

  const { device, observability } = result;
  const presence = observability.presence?.status ?? "OFFLINE";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div className="space-y-1">
        <Link href="/admin/devices" className="ui-caption hover:underline">
          ← Ecrãs
        </Link>
        <PageHeader
          title={device.name ?? "Ecrã"}
          description="Identidade, presença e diagnóstico"
          actions={<StatusBadge status={presence} />}
        />
      </div>

      <section className="space-y-3">
        <SectionHeader title="Identidade" />
        <Card className="border border-[var(--color-border)] bg-[var(--color-surface)] shadow-none">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            <MetadataRow label="Nome">{device.name ?? "—"}</MetadataRow>
            <MetadataRow label="Código">{device.deviceCode ?? "—"}</MetadataRow>
            <MetadataRow label="Tipo">{device.displayType}</MetadataRow>
            <MetadataRow label="Local">{device.location ?? "—"}</MetadataRow>
            <MetadataRow label="Device ID">
              <span className="break-all font-mono text-xs">{device.id}</span>
            </MetadataRow>
            <MetadataRow label="Interacção">{device.interactionMode}</MetadataRow>
            <MetadataRow label="Orientação">{device.orientation}</MetadataRow>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Runtime & diagnósticos"
          description="Presence, playback, sync, network, policy e observabilidade"
        />
        <Card className="border border-[var(--color-border)] bg-[var(--color-surface)] shadow-none">
          <CardContent className="p-4">
            <DeviceObservabilityPanel obs={observability} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
