import Link from "next/link";

export function AccessDenied({
  title = "Acesso negado",
  detail = "Não tem permissão para esta área neste workspace.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="space-y-4 py-10">
      <h1
        className="text-3xl font-semibold text-[var(--color-primary)]"
        style={{ fontFamily: "var(--font-fraunces), serif" }}
      >
        {title}
      </h1>
      <p className="text-sm text-[var(--color-muted-foreground)]">{detail}</p>
      <p className="text-sm text-[var(--color-muted-foreground)]">HTTP 403</p>
      <Link
        href="/admin"
        className="inline-flex rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-medium hover:bg-[var(--color-secondary)]/40"
      >
        Voltar ao dashboard
      </Link>
    </div>
  );
}
