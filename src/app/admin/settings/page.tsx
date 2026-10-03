import Link from "next/link";
import {
  Settings as SettingsIcon,
  Server,
  Upload,
  Clock,
  HardDrive,
  Cloud,
  ChevronRight,
} from "lucide-react";
import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";

export default async function SettingsPage() {
  const session = await requireAdminPage("view_dashboard");
  if (!session) return <AccessDenied />;
  const canManageWorkspace =
    session.role === "ADMIN" || session.role === "SUPER_ADMIN";

  const heartbeatMs = process.env.HEARTBEAT_OFFLINE_AFTER_MS ?? "90000";
  const storageProvider = process.env.MEDIA_STORAGE_PROVIDER ?? "local";
  const maxUploadBytes = process.env.MAX_UPLOAD_BYTES ?? "52428800";
  const maxUploadMB = (Number(maxUploadBytes) / (1024 * 1024)).toFixed(0);

  return (
    <div className="space-y-6">
      <header className="admin-page-header pb-2 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary-soft)]">
            <SettingsIcon className="h-5 w-5 text-[var(--color-primary)]" />
          </div>
          <div>
            <h1 className="ui-page-title">Definições</h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Configurações do sistema e workspace
            </p>
          </div>
        </div>
      </header>

      {/* Workspace Settings Card */}
      {canManageWorkspace && (
        <Link
          href="/admin/settings/workspace"
          className="group flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 shadow-[var(--shadow-subtle)] transition-all hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white shadow-sm">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-foreground)]">
                Definições do workspace
              </p>
              <p className="text-[13px] text-[var(--color-muted-foreground)]">
                Nome, slug e timezone do workspace activo
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)]" />
        </Link>
      )}

      {/* System Info Cards */}
      <div>
        <h2 className="ui-section-title mb-3">Informação do sistema</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Heartbeat */}
          <div className="flex items-start gap-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 shadow-[var(--shadow-subtle)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Clock className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[var(--color-foreground)]">
                Heartbeat offline
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                {(Number(heartbeatMs) / 1000).toFixed(0)}s
                <span className="ml-1 text-xs opacity-60">
                  ({heartbeatMs} ms)
                </span>
              </p>
            </div>
          </div>

          {/* Storage */}
          <div className="flex items-start gap-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 shadow-[var(--shadow-subtle)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <HardDrive className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[var(--color-foreground)]">
                Armazenamento
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                {storageProvider === "r2" ? "Cloudflare R2" : storageProvider}
              </p>
            </div>
          </div>

          {/* Max Upload */}
          <div className="flex items-start gap-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 shadow-[var(--shadow-subtle)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Upload className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[var(--color-foreground)]">
                Upload máximo
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                {maxUploadMB} MB
                <span className="ml-1 text-xs opacity-60">
                  ({maxUploadBytes} bytes)
                </span>
              </p>
            </div>
          </div>

          {/* Direct R2 Upload */}
          <div className="flex items-start gap-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 shadow-[var(--shadow-subtle)]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <Cloud className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[var(--color-foreground)]">
                Upload directo R2
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                Browser PUT via prepare/complete
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)] opacity-70">
                Ignora limite ~4.5 MB do Vercel. CORS configurado para PUT.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
