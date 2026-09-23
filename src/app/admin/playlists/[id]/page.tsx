import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { requireAdminPage } from "@/lib/admin-access";
import { getPlaylistWithItems } from "@/services/playlists";
import { PlaylistBuilder } from "@/features/playlists/playlist-builder";
import { listContentsForPreview } from "@/services/contents";

export default async function PlaylistEditorPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const user = await requireAdminPage("manage_playlists");
  if (!user) return <AccessDenied />;

  const playlistData = await getPlaylistWithItems(id, user.tenantId);
  if (!playlistData) return notFound();

  // Load all tenant contents for the picker
  const allContents = await listContentsForPreview(user.tenantId);

  // Attach content metadata to playlist items
  const itemsWithContent = playlistData.items.map((item) => {
    const content = allContents.find((c) => c.id === item.contentId);
    return {
      ...item,
      content: content || {
        title: "Conteúdo Removido",
        type: "UNKNOWN",
        durationMs: 0,
        payload: {},
        mediaUrl: null,
      },
    };
  });

  const playlist = {
    ...playlistData,
    items: itemsWithContent,
  };

  return (
    <PlaylistBuilder playlist={playlist} contents={allContents} />
  );
}
