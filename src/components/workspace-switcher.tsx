"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WorkspaceSwitcher({
  activeTenantId,
  workspaces,
  fallbackName,
}: {
  activeTenantId: string;
  workspaces: { tenantId: string; name: string; role: string }[];
  fallbackName?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const current =
    workspaces.find((row) => row.tenantId === activeTenantId)?.name ??
    fallbackName ??
    "Workspace";

  if (workspaces.length < 2) {
    return (
      <p className="truncate text-xs font-medium text-[var(--color-foreground)]" title={current}>
        {current}
      </p>
    );
  }

  return (
    <select
      aria-label="Workspace activo"
      className="w-full truncate rounded-md border border-[var(--color-border)] bg-white px-2 py-1.5 text-xs"
      value={activeTenantId}
      disabled={pending}
      onChange={async (event) => {
        const tenantId = event.target.value;
        setPending(true);
        const res = await fetch("/api/workspaces/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId }),
        });
        setPending(false);
        if (res.ok) router.refresh();
      }}
    >
      {workspaces.map((row) => (
        <option key={row.tenantId} value={row.tenantId}>
          {row.name} ({row.role.replaceAll("_", " ")})
        </option>
      ))}
    </select>
  );
}
