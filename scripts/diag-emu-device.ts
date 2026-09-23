import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3003";

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@vitrine360.local",
      password: "Admin123!",
    }),
  });
  const cookie = (login.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
  const res = await fetch(`${BASE}/api/admin/devices`, {
    headers: { Cookie: cookie },
  });
  const data = (await res.json()) as {
    devices: Array<Record<string, unknown>>;
  };
  const emu = (data.devices || []).filter(
    (d) =>
      typeof d.deviceCode === "string" &&
      String(d.deviceCode).startsWith("TV-EMU"),
  );
  console.log(
    JSON.stringify(
      emu.map((d) => ({
        deviceCode: d.deviceCode,
        status: d.status,
        manifestVersion: d.manifestVersion,
        playlist: d.currentPlaylistId,
        lastSeen: d.lastSeenAt,
        presence: d.presence,
        playerState: d.playerState,
      })),
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
