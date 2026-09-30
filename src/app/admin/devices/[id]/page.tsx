import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { getDeviceObservability } from "@/services/devices";
import { DeviceObservabilityPanel } from "@/features/devices/device-observability-panel";
import { DeviceControlConcept } from "@/features/devices/device-control-concept";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetadataRow } from "@/components/ui/metadata-row";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        <Link
          href="/admin/devices"
          className="ui-secondary text-[var(--color-primary)] underline"
        >
          Voltar à lista
        </Link>
      </div>
    );
  }

  const { device, observability } = result;
  const presence = observability.presence?.status ?? "OFFLINE";
  const currentTitle =
    observability.runtime?.currentContentId != null
      ? `Content ${observability.runtime.currentContentId.slice(0, 8)}…`
      : null;
  const playbackStatus = observability.runtime.isPlaying ? "PLAYING" : "IDLE";

  return (
    <div className="mx-auto w-full space-y-8">
      <div className="space-y-1">
        <Link href="/admin/devices" className="ui-caption hover:underline">
          ← Ecrãs
        </Link>
        <PageHeader
          title={device.name ?? "Ecrã"}
          description={[
            device.location ?? null,
            device.displayType,
            device.orientation,
          ]
            .filter(Boolean)
            .join(" · ")}
          actions={<StatusBadge status={presence} />}
        />
      </div>

      <section className="space-y-3">
        <SectionHeader
          title="Live / Current state"
          description="Estado reportado pelo runtime do dispositivo"
        />
        <Card className="border border-[var(--color-border)] bg-[var(--color-surface)] shadow-none">
          <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div
              className="ui-player-canvas relative flex aspect-video items-center justify-center overflow-hidden rounded-[var(--radius-xl)] px-4 text-center"
              aria-label="Área de preview"
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--color-player-primary)_18%,transparent),transparent_65%)]" />
              <div className="relative z-[1]">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-player-muted)]">
                  Current preview
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--color-player-text)]">
                  {currentTitle ?? "Sem conteúdo actual reportado"}
                </p>
                <div className="relative mx-auto mt-5 h-1 w-28 overflow-visible rounded-full bg-white/15">
                  <div className="h-full w-2/5 rounded-full bg-[var(--color-player-primary)]" />
                  <span
                    className="absolute top-1/2 left-[40%] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-player-primary)_40%,transparent)]"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-3">
              <MetadataRow label="Current">
                {currentTitle ?? "—"}
              </MetadataRow>
              <MetadataRow label="Status">{playbackStatus}</MetadataRow>
              <MetadataRow label="Presence">{presence}</MetadataRow>
              <MetadataRow label="Last seen">
                {device.lastSeenAt
                  ? new Date(device.lastSeenAt).toLocaleString("pt-PT")
                  : "—"}
              </MetadataRow>
              <MetadataRow label="Manifest">
                v{device.manifestVersion ?? "—"}
              </MetadataRow>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Device Control" description="Conceito visual" />
        <DeviceControlConcept
          deviceName={device.name ?? device.deviceCode ?? "Ecrã"}
          presence={presence}
          currentTitle={currentTitle}
        />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Device information" />
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
            <MetadataRow label="Health">{presence}</MetadataRow>
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

      <section className="space-y-3">
        <SectionHeader title="Actions" />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/devices"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Voltar à lista
          </Link>
          <span
            className={cn(
              buttonVariants({ variant: "outline" }),
              "pointer-events-none opacity-50",
            )}
            aria-disabled
            title="Coming soon"
          >
            Configurar
          </span>
          <a
            href="#runtime"
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            Diagnóstico
          </a>
        </div>
      </section>
    </div>
  );
}
