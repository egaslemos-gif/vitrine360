import type { ReactNode } from "react";
import { desc, eq } from "drizzle-orm";
import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { listDevicesWithPresence } from "@/services/devices";
import { listContents } from "@/services/contents";
import { listPlaylists } from "@/services/playlists";
import { getTenantById } from "@/services/tenants";
import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import {
  MonitorPlay,
  Wifi,
  Image as ImageIcon,
  ListVideo,
  FolderOpen,
  Clock,
  ArrowUpRight,
  MoreHorizontal,
  Search,
  CalendarClock,
  Activity,
} from "lucide-react";

function greetingForHour(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export default async function AdminDashboardPage() {
  const session = await requireAdminPage("view_dashboard");
  if (!session) return <AccessDenied />;

  const [devices, contents, playlists, tenant, activity] = await Promise.all([
    listDevicesWithPresence(session.tenantId),
    listContents(session.tenantId),
    listPlaylists(session.tenantId),
    getTenantById(session.activeTenantId),
    db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.tenantId, session.tenantId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(8),
  ]);

  const activeDevices = devices.filter((d) => d.status !== "PENDING");
  const onlineCount = activeDevices.filter((d) => d.presence === "ONLINE").length;
  const first = session.name.trim().split(/\s+/)[0] || session.name;
  const greeting = greetingForHour(new Date().getHours());

  const nowPlayingDevice =
    activeDevices.find((d) => d.presence === "ONLINE") ?? activeDevices[0];

  return (
    <div className="space-y-8">
      {/* ── Hero Header ── */}
      <PageHeader
        greeting={`${greeting}, ${first}`}
        title="Painel de Controlo"
        description={`${tenant?.name ?? "Workspace"} está operacional.`}
        actions={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
            <input
              type="search"
              placeholder="Pesquisar…"
              className="h-10 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-4 text-sm text-[var(--color-foreground)] shadow-[var(--shadow-subtle)] transition-all focus:border-[var(--color-primary)] focus:shadow-[var(--shadow-card)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:outline-none"
              style={{ width: "220px" }}
            />
          </div>
        }
      />

      {/* ── Stats Grid ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ecrãs"
          value={activeDevices.length}
          hint="dispositivos pareados"
          tone="accent"
          icon={
            <MonitorPlay className="h-5 w-5 text-[var(--color-primary)]" aria-hidden />
          }
        />
        <StatCard
          title="Online"
          value={onlineCount}
          hint="em contacto agora"
          tone="success"
          icon={
            <Wifi className="h-5 w-5 text-[var(--color-success)]" aria-hidden />
          }
        />
        <StatCard
          title="Conteúdos"
          value={contents.length}
          hint="no workspace"
          tone="info"
          icon={
            <ImageIcon className="h-5 w-5 text-[var(--color-info)]" aria-hidden />
          }
        />
        <StatCard
          title="Playlists"
          value={playlists.length}
          hint="publicáveis"
          tone="warning"
          icon={
            <ListVideo className="h-5 w-5 text-[var(--color-warning)]" aria-hidden />
          }
        />
      </div>

      {/* ── Main 2/3 + 1/3 Grid ── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Devices + Activity */}
        <div className="space-y-6 lg:col-span-3">
          {/* Devices Section */}
          <section>
            <SectionHeader
              title="Ecrãs"
              description="Presença e contacto recente"
              actions={
                <Link
                  href="/admin/devices"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/15"
                >
                  Ver todos
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
              }
            />
            <Card className="mt-4 border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
              <CardContent className="p-0">
                {activeDevices.length === 0 ? (
                  <EmptyState
                    className="m-4 border-0 bg-transparent py-8"
                    icon={<MonitorPlay className="h-8 w-8" aria-hidden />}
                    title="Nenhum ecrã activo"
                    description="Associe um ecrã para começar a distribuir conteúdo."
                    action={
                      <Link
                        href="/admin/devices"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--color-primary-hover)]"
                      >
                        Ir para Ecrãs
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    }
                  />
                ) : (
                  <div className="divide-y divide-[var(--color-border-subtle)]">
                    {activeDevices.slice(0, 6).map((d) => (
                      <Link
                        key={d.id}
                        href={`/admin/devices/${d.id}`}
                        className="group flex items-center gap-4 px-5 py-3.5 transition-all hover:bg-[var(--color-row-hover)]"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] transition-all group-hover:scale-105 group-hover:shadow-sm">
                          <MonitorPlay
                            className="h-5 w-5 text-[var(--color-primary)]"
                            aria-hidden
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                            {d.name ?? d.deviceCode ?? d.id.slice(0, 8)}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                            {d.location ?? "—"}
                            {" · v"}
                            {d.manifestVersion ?? "—"}
                            {d.lastSeenAt
                              ? ` · ${timeAgo(new Date(d.lastSeenAt))}`
                              : ""}
                          </p>
                        </div>
                        <StatusBadge status={d.presence} />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Activity Section */}
          <section>
            <SectionHeader
              title="Actividade recente"
              actions={
                <Link
                  href="/admin/logs"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/15"
                >
                  Ver tudo
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
              }
            />
            <Card className="mt-4 border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
              <CardContent className="p-0">
                {activity.length === 0 ? (
                  <div className="flex items-center gap-3 px-5 py-8 text-sm text-[var(--color-text-muted)]">
                    <Activity className="h-5 w-5 opacity-40" aria-hidden />
                    Sem actividade recente.
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--color-border-subtle)]">
                    {activity.map((row) => (
                      <li
                        key={row.id}
                        className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--color-row-hover)]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)]">
                          <Activity
                            className="h-4 w-4 text-[var(--color-text-muted)]"
                            aria-hidden
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                            {row.action}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                            {row.createdAt
                              ? timeAgo(new Date(row.createdAt))
                              : "—"}
                            {row.resource ? ` · ${row.resource}` : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Right Column: Now Playing + Quick Links */}
        <div className="space-y-6 lg:col-span-2">
          {/* Now Playing Card */}
          <section>
            <SectionHeader
              title="Now Playing"
              description="Ecrã em destaque"
            />
            <Card className="mt-4 group relative overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
              <CardContent className="p-0">
                {/* Player Preview */}
                <div
                  className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-[#0f0e13]"
                  aria-hidden
                >
                  {/* Subtle inner shadow for depth */}
                  <div className="absolute inset-0 z-10 shadow-[inset_0_4px_24px_rgba(0,0,0,0.4)] pointer-events-none" />

                  {/* Dark, rich radial gradient background mimicking a screen glow */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(circle at 50% 40%, rgba(109, 74, 255, 0.15) 0%, rgba(15, 14, 19, 1) 70%)",
                    }}
                  />

                  {/* Decorative subtle grid */}
                  <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
                      backgroundSize: "32px 32px",
                      backgroundPosition: "center center",
                    }}
                  />

                  {/* Floating glassmorphic control center */}
                  <div className="relative z-[1] flex flex-col items-center justify-center px-6 py-5 rounded-[1.25rem] bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)] shadow-[0_0_24px_rgba(109,74,255,0.4)] transition-transform hover:scale-105 cursor-pointer">
                      <MonitorPlay className="h-5 w-5 text-white ml-0.5" />
                    </div>
                    
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-white/50">
                      Now playing
                    </p>
                    <p className="mt-1 text-sm font-medium text-white max-w-[200px] truncate">
                      {nowPlayingDevice
                        ? (nowPlayingDevice.name ?? "Ecrã")
                        : "Sem ecrã"}
                    </p>

                    {/* Minimalist Timeline */}
                    <div className="mt-5 w-40">
                      <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full w-1/3 rounded-full bg-[var(--color-primary)]" />
                      </div>
                      <div className="mt-2 flex justify-between text-[10px] font-medium tabular-nums text-white/40">
                        <span>0:00</span>
                        <span>0:00</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Device info */}
                {nowPlayingDevice ? (
                  <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] px-5 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                        {nowPlayingDevice.name ?? nowPlayingDevice.deviceCode}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge status={nowPlayingDevice.presence} />
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {nowPlayingDevice.location ?? "—"}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/admin/devices/${nowPlayingDevice.id}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)] hover:text-white hover:shadow-md"
                    >
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                ) : (
                  <div className="border-t border-[var(--color-border-subtle)] px-5 py-4">
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Sem ecrãs para mostrar estado de reprodução.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Quick-Links / Content Section */}
          <section>
            <SectionHeader
              title="Conteúdo"
              description="Acesso rápido à biblioteca"
            />
            <div className="mt-4 grid gap-3">
              <QuickLinkCard
                href="/admin/media"
                icon={<FolderOpen className="h-5 w-5" aria-hidden />}
                title="Media"
                subtitle="Biblioteca de ficheiros"
                iconBg="bg-blue-50 text-blue-600"
              />
              <QuickLinkCard
                href="/admin/playlists"
                icon={<ListVideo className="h-5 w-5" aria-hidden />}
                title="Playlists"
                subtitle={`${playlists.length} playlist${playlists.length === 1 ? "" : "s"}`}
                iconBg="bg-purple-50 text-purple-600"
              />
              <QuickLinkCard
                href="/admin/contents"
                icon={<ImageIcon className="h-5 w-5" aria-hidden />}
                title="Conteúdos"
                subtitle={`${contents.length} conteúdo${contents.length === 1 ? "" : "s"} · templates e studio`}
                iconBg="bg-amber-50 text-amber-600"
              />
              <QuickLinkCard
                href="/admin/schedules"
                icon={<CalendarClock className="h-5 w-5" aria-hidden />}
                title="Agendamentos"
                subtitle="Programação de reprodução"
                iconBg="bg-emerald-50 text-emerald-600"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function QuickLinkCard({
  href,
  icon,
  title,
  subtitle,
  iconBg = "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
}: {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  iconBg?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-subtle)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] hover:border-[var(--color-border-strong)]"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] transition-transform group-hover:scale-110 ${iconBg}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
          {subtitle}
        </p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
    </Link>
  );
}
