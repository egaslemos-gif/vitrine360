"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const ASSIGNABLE_ROLES = [
  "ADMIN",
  "EDITOR",
  "OPERATOR",
  "VIEWER",
] as const;

const SUPER_ROLES = ["SUPER_ADMIN", ...ASSIGNABLE_ROLES] as const;

type Member = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
};

export function MembersManager({
  members,
  currentUserId,
  operatorRole,
}: {
  members: Member[];
  currentUserId: string;
  operatorRole: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof SUPER_ROLES)[number]>("EDITOR");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const roles =
    operatorRole === "SUPER_ADMIN" ? SUPER_ROLES : ASSIGNABLE_ROLES;

  async function createMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password, role }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Erro");
      return;
    }
    setEmail("");
    setName("");
    setPassword("");
    router.refresh();
  }

  async function patch(body: Record<string, unknown>, id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Erro");
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Novo membro</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
            Convites por email ainda não estão disponíveis. Cria a conta com
            password nesta fase.
          </p>
          <form onSubmit={createMember} className="space-y-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select
                className="flex h-9 w-full rounded-md border border-[var(--color-border)] bg-white px-2 text-sm"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as (typeof SUPER_ROLES)[number])
                }
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Criar membro</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membros do workspace</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-[var(--color-border)]">
          {error ? (
            <p className="pb-3 text-sm text-[var(--color-destructive)]">{error}</p>
          ) : null}
          {members.map((u) => {
            const isSelf = u.id === currentUserId;
            const pending = busyId === u.id;
            return (
              <div key={u.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {u.name}
                      {isSelf ? (
                        <span className="ml-2 text-[10px] uppercase text-[var(--color-primary)]">
                          tu
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {u.email}
                    </p>
                  </div>
                  <Badge variant="muted">{u.status}</Badge>
                </div>
                {!isSelf ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="h-8 rounded-md border border-[var(--color-border)] bg-white px-2 text-xs"
                      value={u.role}
                      disabled={pending}
                      onChange={(e) =>
                        patch(
                          { action: "role", id: u.id, role: e.target.value },
                          u.id,
                        )
                      }
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                      {u.role === "SUPER_ADMIN" &&
                      operatorRole !== "SUPER_ADMIN" ? (
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      ) : null}
                    </select>
                    {u.status === "ACTIVE" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          patch({ action: "suspend", id: u.id }, u.id)
                        }
                      >
                        Suspender
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          patch({ action: "activate", id: u.id }, u.id)
                        }
                      >
                        Activar
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        patch({ action: "remove", id: u.id }, u.id)
                      }
                    >
                      Remover
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {u.role} — use outro ADMIN para alterar a tua membership
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
