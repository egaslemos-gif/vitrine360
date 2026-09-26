import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";

/** Platform Identity flag OFF — console unavailable (not a tenant permission issue). */
export function PlatformDisabled() {
  return (
    <div className="space-y-4 py-10" role="status">
      <h1 className="ui-page-title">Platform Console indisponível</h1>
      <p className="ui-secondary max-w-xl">
        A identidade de plataforma está desactivada neste ambiente
        (<span className="font-mono text-xs"> (PLATFORM_IDENTITY_ENABLED)</span>.
        O console não concede acesso com a flag desligada.
      </p>
      <Link
        href="/admin"
        className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-muted)]"
      >
        Voltar ao workspace
      </Link>
    </div>
  );
}

export function PlatformAccessDenied() {
  return (
    <AccessDenied
      title="Acesso ao Platform Console negado"
      detail="É necessária a permissão platform.tenants.read (Platform Identity). O papel SUPER_ADMIN do workspace não concede acesso à plataforma."
    />
  );
}
