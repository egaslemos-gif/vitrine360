"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const OAUTH_ERRORS: Record<string, string> = {
  config: "O login Google ainda não está configurado neste servidor.",
  oauth_state: "O pedido Google expirou. Tente novamente.",
  oauth_callback: "A resposta do Google não é válida.",
  oauth_cancelled: "O login Google foi cancelado.",
  email_unverified: "A conta Google não tem o email verificado.",
  invalid_token: "Não foi possível validar a identidade Google.",
  membership: "Esta conta não tem um workspace activo.",
};

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryErrorCode = params.get("error");
  const queryError = queryErrorCode
    ? (OAUTH_ERRORS[queryErrorCode] ?? "Não foi possível entrar com Google.")
    : null;
  const queryNotice =
    params.get("link") === "google"
      ? "Entre com a password desta conta para ligar o Google. A ligação não é feita só pelo email."
      : null;
  const [email, setEmail] = useState("admin@vitrine360.local");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const shownError = error ?? queryError;
  const shownNotice = queryNotice;

  const showDevHint = process.env.NODE_ENV !== "production";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Falha no login");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10">
      <Link
        href="/"
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Página inicial
      </Link>
      <Card className="w-[min(100%,28rem)] shrink-0 border border-[var(--color-border)] bg-[var(--color-surface)]/90 shadow-lg backdrop-blur">
        <CardHeader>
          <CardTitle
            className="text-3xl text-[var(--color-primary)]"
            style={{ fontFamily: "var(--font-fraunces), serif" }}
          >
            Vitrine360
          </CardTitle>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Digital Display & Presentation — sign in
          </p>
          {showDevHint ? (
            <p className="mt-2 text-xs text-[var(--color-warning)]">
              Desenvolvimento: após{" "}
              <code className="rounded bg-[var(--color-muted)] px-1">npm run db:seed</code> use
              as credenciais indicadas no output do seed (nunca para produção).
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="w-full min-w-0 space-y-4">
            <div className="w-full min-w-0 space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="w-full min-w-0 space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {shownError ? (
              <p className="text-sm text-[var(--color-destructive)]">{shownError}</p>
            ) : null}
            {shownNotice ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">{shownNotice}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "A entrar…" : "Entrar"}
            </Button>
          </form>
          <a
            href="/api/auth/google"
            className="mt-4 flex h-9 w-full items-center justify-center rounded-md border border-[var(--color-border)] text-sm font-medium"
          >
            Continuar com Google
          </a>
          <p className="mt-4 text-center text-sm text-[var(--color-muted-foreground)]">
            <Link
              href="/"
              className="font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
            >
              Voltar à página inicial
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
