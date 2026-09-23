import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { listPlaylistsWithUsage } from "@/services/playlists";
import { PlaylistManager } from "@/features/playlists/playlist-manager";

export default async function PlaylistsPage() {
  const session = await requireAdminPage("manage_playlists");
  if (!session) return <AccessDenied />;

  const playlistsWithUsage = await listPlaylistsWithUsage(session.tenantId);

  return (
    <div className="space-y-8">
      <header className="admin-page-header flex flex-col pb-4 pt-4">
        <h1
          className="text-3xl font-semibold text-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Playlists
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Sequências de reprodução — gerir e atribuir a devices
        </p>
      </header>
      <PlaylistManager playlists={playlistsWithUsage} />
    </div>
  );
}
