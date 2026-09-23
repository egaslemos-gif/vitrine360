"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const COMMON_TIMEZONES = [
  "UTC",
  "Africa/Maputo",
  "Africa/Johannesburg",
  "Europe/Lisbon",
  "Europe/London",
  "America/Sao_Paulo",
  "America/New_York",
];

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
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ws-name">Nome do workspace</Label>
        <Input
          id="ws-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ws-tz">Timezone</Label>
        <select
          id="ws-tz"
          className="flex h-9 w-full rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
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
      <Button type="submit" disabled={pending}>
        {pending ? "A guardar…" : "Guardar"}
      </Button>
      {saved ? (
        <p className="text-sm text-emerald-700">Guardado.</p>
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--color-destructive)]">{error}</p>
      ) : null}
    </form>
  );
}
