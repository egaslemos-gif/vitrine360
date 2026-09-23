/**
 * Lab + DoD readiness for Android TV hardware validation.
 * Does not claim HARDWARE PASS — prints what is ready vs still NOT TESTED.
 *
 *   npm run hardware:status
 *   BASE_URL=http://192.168.100.6:3000 npm run hardware:status
 *   PRODUCTION_URL=https://vitrine360-psi.vercel.app npm run hardware:status
 */
import fs from "node:fs";
import path from "node:path";

const LOCAL = "http://127.0.0.1:3000";
const BASE = (process.env.BASE_URL ?? LOCAL).replace(/\/$/, "");
const PRODUCTION = (
  process.env.PRODUCTION_URL ?? "https://vitrine360-psi.vercel.app"
).replace(/\/$/, "");
const root = process.cwd();

function exists(rel: string) {
  return fs.existsSync(path.join(root, rel));
}

function isEphemeralTunnel(url: string) {
  return /trycloudflare\.com/i.test(url);
}

async function probe(url: string) {
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual" });
    return res.status;
  } catch {
    return 0;
  }
}

async function main() {
  const player = await probe(`${BASE}/player`);
  const admin = await probe(`${BASE}/admin/login`);
  const smartTv = await probe(`${BASE}/tv.html`);
  const localPlayer = BASE === LOCAL ? player : await probe(`${LOCAL}/player`);
  const localAdmin = BASE === LOCAL ? admin : await probe(`${LOCAL}/admin/login`);
  const swText = fs.readFileSync(path.join(root, "public/sw.js"), "utf8");

  const software = [
    ["ADR-006 Passive Runtime", exists("docs/architecture/adr/006-player-runtime.md")],
    ["ADR-007 media decision", exists("docs/architecture/adr/007-media-access.md")],
    ["rate-limit.ts", exists("src/lib/rate-limit.ts")],
    ["SW offline-boot HTML", exists("public/v360-offline.html")],
    ["SW shell cache", /SHELL_CACHE\s*=\s*["']vitrine360-shell-v\d+["']/.test(swText)],
    ["Smart TV static player", exists("public/tv.html") && exists("public/tv.js")],
    ["emu reset=1 evidence", exists("docs/evidence/emu-fail-reset1.png")],
    ["ACCEPTANCE.md", exists("docs/ACCEPTANCE.md")],
    ["android-tv-checklist.md", exists("docs/android-tv-checklist.md")],
    ["smart-tv-quickstart.md", exists("docs/smart-tv-quickstart.md")],
    ["hw-sample.mp4 fixture", exists("fixtures/hw-sample.mp4")],
    ["emu cold offline evidence", exists("docs/evidence/emu-cold-offline-25s.png")],
    ["emu 1080p evidence", exists("docs/evidence/emu-display-1920x1080.png")],
    ["emu 5min offline soak", exists("docs/evidence/emu-soak-offline-t5m.png")],
    ["emu network recovery v2", exists("docs/evidence/emu-recovery-online-v2b.png")],
    ["emu HTTPS tunnel pairing", exists("docs/evidence/emu-tv-avd-https-tunnel-boot-2026-09-18.png")],
    ["emu HTTPS activation screen", exists("docs/evidence/emu-tv-avd-https-pairing-code-2026-09-18.png")],
    ["emu HTTPS play attempt", exists("docs/evidence/emu-tv-avd-https-play-2026-09-18.png")],
  ] as const;

  const httpsBase = process.env.HTTPS_URL?.replace(/\/$/, "");
  const httpsLab =
    httpsBase && !isEphemeralTunnel(httpsBase)
      ? {
          url: httpsBase,
          playerHttpStatus: await probe(`${httpsBase}/player`),
          tvHtmlHttpStatus: await probe(`${httpsBase}/tv.html`),
        }
      : httpsBase
        ? {
            url: httpsBase,
            playerHttpStatus: await probe(`${httpsBase}/player`),
            tvHtmlHttpStatus: await probe(`${httpsBase}/tv.html`),
            note: "ephemeral trycloudflare host — ignore if unreachable; use production for HDMI",
          }
        : null;

  const production = {
    url: PRODUCTION,
    playerHttpStatus: await probe(`${PRODUCTION}/player`),
    tvHtmlHttpStatus: await probe(`${PRODUCTION}/tv.html`),
    adminLoginHttpStatus: await probe(`${PRODUCTION}/admin/login`),
  };

  const hwPendingDir = path.join(root, "docs/evidence/hw-pending");
  const pendingFiles = fs.existsSync(hwPendingDir)
    ? fs
        .readdirSync(hwPendingDir)
        .filter((f) => /\.(png|jpg|jpeg|webp|mp4)$/i.test(f))
    : [];

  console.log(
    JSON.stringify(
      {
        baseUrl: BASE,
        production,
        https: httpsLab,
        localLab: {
          url: LOCAL,
          playerHttpStatus: localPlayer,
          adminLoginHttpStatus: localAdmin,
          reachable: localPlayer > 0 && localAdmin > 0,
        },
        lab: {
          playerHttpStatus: player,
          adminLoginHttpStatus: admin,
          smartTvHttpStatus: smartTv,
          reachable: player > 0 && admin > 0,
          staleTunnel: isEphemeralTunnel(BASE) && player === 0,
        },
        softwareArtifacts: Object.fromEntries(
          software.map(([k, v]) => [k, v ? "present" : "MISSING"]),
        ),
        hardwareEvidence: {
          pendingScreenshotCount: pendingFiles.length,
          pendingFiles,
          status:
            pendingFiles.length === 0
              ? "NOT TESTED — drop HDMI evidence into docs/evidence/hw-pending/"
              : "PARTIAL — review and update checklist/HARDWARE report",
        },
        dodBlocking: [
          "Android TV Box + HDMI + Smart TV",
          "Pairing / playlist / video on box",
          "Offline playback + offline reboot on box",
          "Network recovery + heartbeat on box",
          "Kiosk / auto-start (or KNOWN LIMITATION)",
        ],
        nextOperatorSteps: [
          `Box HDMI (DoD, HTTPS estável): ${PRODUCTION}/player`,
          `Smart TV Sraf only (≠ DoD): ${PRODUCTION}/tv.html`,
          `Admin (produção): ${PRODUCTION}/admin/login`,
          localPlayer > 0
            ? `LAN fallback (online-only): ${LOCAL}/player`
            : "LAN lab server is down — HDMI should use production HTTPS, not localhost",
          "Pair via Admin (or npm run hardware:prep with ACTIVATION_CODE)",
          "Fill docs/evidence/hw-pending/RESULTS-TEMPLATE.md + screenshots",
          "Update docs/android-tv-checklist.md HARDWARE columns",
        ],
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
