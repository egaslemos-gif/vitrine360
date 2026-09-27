"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import {
  createPlaylist,
  createPlaylistSchema,
  deletePlaylist,
  duplicatePlaylist,
  addPlaylistItem,
  removePlaylistItem,
  reorderPlaylistItems,
  updatePlaylistDetails,
  updatePlaylistItem,
} from "@/services/playlists";

export async function createPlaylistAction(formData: FormData) {
  const user = await requireSession("manage_playlists");

  const input = createPlaylistSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  await createPlaylist(input, user.tenantId, user.id);
  revalidatePath("/admin/playlists");
}

export async function updatePlaylistDetailsAction(
  playlistId: string,
  data: { name: string; description?: string },
) {
  const user = await requireSession("manage_playlists");

  await updatePlaylistDetails(playlistId, data, user.tenantId, user.id);
  revalidatePath("/admin/playlists");
  revalidatePath(`/admin/playlists/${playlistId}`);
}

export async function duplicatePlaylistAction(playlistId: string) {
  const user = await requireSession("manage_playlists");

  await duplicatePlaylist(playlistId, user.tenantId, user.id);
  revalidatePath("/admin/playlists");
}

export async function deletePlaylistAction(playlistId: string) {
  const user = await requireSession("manage_playlists");

  await deletePlaylist(playlistId, user.tenantId, user.id);
  revalidatePath("/admin/playlists");
}

export async function addPlaylistItemAction(
  playlistId: string,
  contentId: string,
) {
  const user = await requireSession("manage_playlists");

  await addPlaylistItem({
    playlistId,
    contentId,
    tenantId: user.tenantId,
    userId: user.id,
  });
  revalidatePath(`/admin/playlists/${playlistId}`);
}

export async function removePlaylistItemAction(
  playlistId: string,
  itemId: string,
) {
  const user = await requireSession("manage_playlists");

  await removePlaylistItem(playlistId, itemId, user.tenantId, user.id);
  revalidatePath(`/admin/playlists/${playlistId}`);
}

export async function reorderPlaylistItemsAction(
  playlistId: string,
  orderedItemIds: string[],
) {
  const user = await requireSession("manage_playlists");

  await reorderPlaylistItems(playlistId, orderedItemIds, user.tenantId, user.id);
  revalidatePath(`/admin/playlists/${playlistId}`);
}

export async function updatePlaylistItemAction(
  playlistId: string,
  itemId: string,
  updates: {
    durationOverrideMs?: number | null;
    transition?: string;
    fitMode?: string;
    active?: boolean;
  },
) {
  const user = await requireSession("manage_playlists");

  await updatePlaylistItem(playlistId, itemId, updates, user.tenantId, user.id);
  revalidatePath(`/admin/playlists/${playlistId}`);
}
