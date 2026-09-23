import { requireSession } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { listDevicesWithPresence } from "@/services/devices";
import { listContents } from "@/services/contents";
import { listPlaylists } from "@/services/playlists";

export async function GET() {
  try {
    const session = await requireSession("view_dashboard");
    const [devices, contents, playlists] = await Promise.all([
      listDevicesWithPresence(session.tenantId),
      listContents(session.tenantId),
      listPlaylists(session.tenantId),
    ]);
    const activeDevices = devices.filter((d) => d.status !== "PENDING");
    const onlineCount = activeDevices.filter((d) => d.presence === "ONLINE").length;
    const awayCount = activeDevices.filter((d) => d.presence === "AWAY").length;
    const offlineCount = activeDevices.filter((d) => d.presence === "OFFLINE").length;
    const totalCount = onlineCount + awayCount + offlineCount;
    return jsonOk({
      totalCount,
      onlineCount,
      awayCount,
      offlineCount,
      activePlaylists: playlists.filter((p) => p.status === "ACTIVE").length,
      contents: contents.length,
      devices: devices
        .filter((d) => d.status !== "PENDING")
        .map((d) => ({
          id: d.id,
          deviceCode: d.deviceCode,
          name: d.name,
          presence: d.presence,
          lastSeenAt: d.lastSeenAt,
          playlistId: d.currentPlaylistId,
          manifestVersion: d.manifestVersion,
        })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
