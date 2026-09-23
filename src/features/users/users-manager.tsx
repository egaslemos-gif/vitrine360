"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "EDITOR",
  "OPERATOR",
  "VIEWER",
] as const;

export function UsersManager({
  users,
}: {
  users: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
  }[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("EDITOR");
  const [error, setError] = useState<string | null>(null);

  async function createUser(e: React.FormEvent) {
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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Novo utilizador</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createUser} className="space-y-3">
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
                  setRole(e.target.value as (typeof ROLES)[number])
                }
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Criar</Button>
            {error ? (
              <p className="text-sm text-[var(--color-destructive)]">{error}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Utilizadores</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-[var(--color-border)]">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div>
                <p className="font-medium">{u.name}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {u.email}
                </p>
              </div>
              <Badge variant="muted">{u.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
