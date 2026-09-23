import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { getDeviceObservability } from "@/services/devices";
import { DeviceObservabilityPanel } from "@/features/devices/device-observability-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      <div className="space-y-4 p-4">
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

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <header className="space-y-2">
        <Link
          href="/admin/devices"
          className="text-xs text-[var(--color-muted-foreground)] underline"
        >
          ← Devices
        </Link>
        <h1
          className="text-3xl font-bold tracking-tight text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          {device.name ?? "Ecrã"}
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Observabilidade operacional — presença, policy e estado reportado
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidade</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase text-[var(--color-muted-foreground)]">
              Device ID
            </div>
            <div className="font-mono text-xs break-all">{device.id}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--color-muted-foreground)]">
              Código
            </div>
            <div>{device.deviceCode ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--color-muted-foreground)]">
              Hardware
            </div>
            <div>{device.displayType}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--color-muted-foreground)]">
              Localização
            </div>
            <div>{device.location ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--color-muted-foreground)]">
              Interaction (config)
            </div>
            <div>{device.interactionMode}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--color-muted-foreground)]">
              Orientation (config)
            </div>
            <div>{device.orientation}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Observabilidade</CardTitle>
        </CardHeader>
        <CardContent>
          <DeviceObservabilityPanel obs={observability} />
        </CardContent>
      </Card>
    </div>
  );
}
