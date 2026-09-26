import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";

export default async function SettingsPage() {
  const session = await requireAdminPage("view_dashboard");
  if (!session) return <AccessDenied />;
  const canManageWorkspace =
    session.role === "ADMIN" || session.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <header className="admin-page-header pb-4 pt-4">
        <h1
          className="text-3xl font-semibold text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Settings
        </h1>
      </header>

      {canManageWorkspace ? (
        <p className="text-sm">
          <Link
            href="/admin/settings/workspace"
            className="font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
          >
            Definições do workspace
          </Link>
          {" — "}
          nome e timezone
        </p>
      ) : null}

      <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-muted-foreground)]">
        <li>
          Heartbeat offline window:{" "}
          {process.env.HEARTBEAT_OFFLINE_AFTER_MS ?? "90000"} ms
        </li>
        <li>
          Media storage: {process.env.MEDIA_STORAGE_PROVIDER ?? "local"}
        </li>
        <li>Max upload: {process.env.MAX_UPLOAD_BYTES ?? "52428800"} bytes</li>
        <li>
          Direct R2 upload: browser PUT via prepare/complete (bypasses Vercel
          ~4.5MB body limit). Bucket CORS must allow PUT from this origin.
        </li>
      </ul>
    </div>
  );
}
