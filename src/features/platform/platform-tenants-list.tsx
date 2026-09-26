"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
};

type ListResponse = {
  tenants: TenantRow[];
  page: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
  error?: string;
};

const PAGE_LIMIT = 20;

export function PlatformTenantsList() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async (cursor: string | null, append: boolean) => {
    const qs = new URLSearchParams({ limit: String(PAGE_LIMIT) });
    if (cursor) qs.set("cursor", cursor);
    const res = await fetch(`/api/platform/tenants?${qs}`, {
      credentials: "include",
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as ListResponse;
    if (!res.ok) {
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    setTenants((prev) =>
      append ? [...prev, ...body.tenants] : body.tenants,
    );
    setNextCursor(body.page.nextCursor);
    setHasMore(body.page.hasMore);
  }, []);

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      try {
        setError(null);
        await load(null, false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Falha ao carregar");
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  function loadMore() {
    if (!nextCursor || pending) return;
    startTransition(async () => {
      try {
        setError(null);
        await load(nextCursor, true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao carregar");
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Observabilidade read-only de metadata de workspaces. Sem conteúdo, dispositivos ou billing."
      />

      {!loaded && !error ? <LoadingState label="A carregar tenants…" /> : null}

      {error ? (
        <ErrorState
          title="Não foi possível listar tenants"
          description={error}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLoaded(false);
                setError(null);
                startTransition(async () => {
                  try {
                    await load(null, false);
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Falha ao carregar",
                    );
                  } finally {
                    setLoaded(true);
                  }
                });
              }}
            >
              Tentar novamente
            </Button>
          }
        />
      ) : null}

      {loaded && !error && tenants.length === 0 ? (
        <EmptyState
          title="Nenhum tenant"
          description="Não existem workspaces registados para observar."
        />
      ) : null}

      {tenants.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">
              Lista de tenants da plataforma (metadata)
            </caption>
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Nome
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Slug
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Estado
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Criado
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">Acções</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-muted)]/30"
                >
                  <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">
                    {t.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                    {t.slug}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {t.createdAt}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/platform/tenants/${t.id}`}
                      className="text-sm font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
                    >
                      Ver detalhe
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {hasMore ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={loadMore}
          >
            {pending ? "A carregar…" : "Carregar mais"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
