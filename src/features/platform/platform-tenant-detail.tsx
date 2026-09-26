"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ErrorState,
  LoadingState,
} from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { MetadataRow } from "@/components/ui/metadata-row";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
};

export function PlatformTenantDetail({ tenantId }: { tenantId: string }) {
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    const res = await fetch(`/api/platform/tenants/${tenantId}`, {
      credentials: "include",
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as {
      tenant?: TenantRow;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    setTenant(body.tenant ?? null);
  }, [tenantId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        await reload();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Falha ao carregar");
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  function runLifecycle(action: "suspend" | "reactivate") {
    setActionError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/platform/tenants/${tenantId}/${action}`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        );
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          tenant?: { status: string };
        };
        if (!res.ok) {
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        await reload();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Falha na operação");
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tenant?.name ?? "Tenant"}
        description="Detalhe de metadata e lifecycle. Sem acesso a conteúdo do workspace."
        actions={
          <Link
            href="/platform/tenants"
            className="inline-flex h-8 items-center rounded-md border border-[var(--color-border)] px-3 text-xs font-medium hover:bg-[var(--color-muted)]"
          >
            Voltar à lista
          </Link>
        }
      />

      {!loaded && !error ? <LoadingState /> : null}

      {error ? (
        <ErrorState
          title="Não foi possível carregar o tenant"
          description={error}
          action={
            <Link
              href="/platform/tenants"
              className="inline-flex h-9 items-center rounded-md border border-[var(--color-border)] px-4 text-sm font-medium hover:bg-[var(--color-muted)]"
            >
              Voltar
            </Link>
          }
        />
      ) : null}

      {loaded && !error && tenant ? (
        <section
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
          aria-labelledby="tenant-meta-heading"
        >
          <h2 id="tenant-meta-heading" className="ui-section-title mb-4">
            Metadata
          </h2>
          <div className="space-y-3">
            <MetadataRow label="ID">
              <span className="break-all font-mono text-xs">{tenant.id}</span>
            </MetadataRow>
            <MetadataRow label="Nome">{tenant.name}</MetadataRow>
            <MetadataRow label="Slug">
              <span className="font-mono text-xs">{tenant.slug}</span>
            </MetadataRow>
            <MetadataRow label="Estado">
              <StatusBadge status={tenant.status} />
            </MetadataRow>
            <MetadataRow label="Criado em">{tenant.createdAt}</MetadataRow>
          </div>

          <div className="mt-6 space-y-3 border-t border-[var(--color-border)] pt-4">
            <h3 className="text-sm font-semibold">Lifecycle</h3>
            <p className="ui-caption text-[var(--color-muted-foreground)]">
              Suspender bloqueia sessões, devices, experience e media deste
              tenant. Não apaga dados. Requer{" "}
              <span className="font-mono text-[10px]">
                platform.tenants.suspend
              </span>
              .
            </p>
            {actionError ? (
              <p className="text-sm text-[var(--color-danger)]" role="alert">
                {actionError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {tenant.status === "ACTIVE" ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => runLifecycle("suspend")}
                >
                  {pending ? "A suspender…" : "Suspender tenant"}
                </Button>
              ) : null}
              {tenant.status === "SUSPENDED" ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={pending}
                  onClick={() => runLifecycle("reactivate")}
                >
                  {pending ? "A reactivar…" : "Reactivar tenant"}
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
