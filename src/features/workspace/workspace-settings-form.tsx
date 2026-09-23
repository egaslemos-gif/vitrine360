"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const COMMON_TIMEZONES = [
  "UTC",
  "Africa/Maputo",
  "Africa/Johannesburg",
  "Europe/Lisbon",
  "Europe/London",
  "America/Sao_Paulo",
  "America/New_York",
];

const fieldSelectClass =
  "box-border flex h-9 w-full min-w-0 max-w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

export function WorkspaceSettingsForm({
  initialName,
  initialTimezone,
}: {
  initialName: string;
  initialTimezone: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const zones = COMMON_TIMEZONES.includes(initialTimezone)
    ? COMMON_TIMEZONES
    : [initialTimezone, ...COMMON_TIMEZONES];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/admin/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, timezone }),
    });
    setPending(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Erro ao guardar");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-xl border border-[var(--color-border)] shadow-[var(--shadow-subtle)]">
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="w-full min-w-0 space-y-5">
          <div className="w-full min-w-0 space-y-2">
            <Label htmlFor="ws-name">Nome do workspace</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              autoComplete="organization"
            />
          </div>
          <div className="w-full min-w-0 space-y-2">
            <Label htmlFor="ws-tz">Timezone</Label>
            <select
              id="ws-tz"
              className={fieldSelectClass}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" disabled={pending}>
              {pending ? "A guardar…" : "Guardar"}
            </Button>
            {saved ? (
              <p className="text-sm text-[var(--color-success)]">Guardado.</p>
            ) : null}
            {error ? (
              <p className="text-sm text-[var(--color-destructive)]">{error}</p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
