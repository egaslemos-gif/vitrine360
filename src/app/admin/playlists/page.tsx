import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { listPlaylistsWithUsage } from "@/services/playlists";
import { PlaylistManager } from "@/features/playlists/playlist-manager";
import { PageHeader } from "@/components/ui/page-header";

export default async function PlaylistsPage() {
  const session = await requireAdminPage("manage_playlists");
  if (!session) return <AccessDenied />;

  const playlistsWithUsage = await listPlaylistsWithUsage(session.tenantId);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <PageHeader
        title="Playlists"
        description="Ordene conteúdos, durações e transições para os ecrãs."
      />
      <PlaylistManager playlists={playlistsWithUsage} />
    </div>
  );
}
