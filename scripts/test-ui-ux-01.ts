/**
 * UI/UX-01 — Design system integrity (static + contract checks).
 * Run: npm run test:ui-ux-01
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  resolveMediaTypeKind,
  type MediaTypeKind,
} from "../src/components/ui/type-badge";
import {
  ADMIN_NAV,
  NAV_SECTION_ORDER,
  navGroupedForRole,
  navForRole,
} from "../src/components/admin-nav";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function main() {
  console.log("UI/UX-01");

  // UI-UX-001 — Design tokens
  const css = read("src/app/globals.css");
  for (const token of [
    "--color-background",
    "--color-surface",
    "--color-surface-muted",
    "--color-border",
    "--color-text-primary",
    "--color-text-secondary",
    "--color-text-muted",
    "--color-primary",
    "--color-primary-hover",
    "--color-success",
    "--color-warning",
    "--color-danger",
    "--color-info",
    "--color-preview-bg",
  ]) {
    assert.ok(css.includes(token), `UI-UX-001 token ${token}`);
  }
  for (const cls of [
    ".ui-page-title",
    ".ui-section-title",
    ".ui-card-title",
    ".ui-body",
    ".ui-secondary",
    ".ui-caption",
    ".ui-sidebar-section",
  ]) {
    assert.ok(css.includes(cls), `UI-UX-001 typography ${cls}`);
  }
  const titleBlock = css.slice(
    css.indexOf(".ui-page-title"),
    css.indexOf(".ui-section-title"),
  );
  assert.ok(
    titleBlock.includes("--font-sans") || titleBlock.includes("font-sans"),
    "UI-UX-001 page title uses Inter/sans",
  );
  assert.ok(
    !titleBlock.includes("font-display"),
    "UI-UX-001 page title not Fraunces",
  );
  console.log("  UI-UX-001 PASS");

  // UI-UX-002 — StatusBadge SSoT
  const statusSrc = read("src/components/ui/status-badge.tsx");
  for (const tone of ["ONLINE", "AWAY", "OFFLINE", "INSTABLE"]) {
    assert.ok(statusSrc.includes(tone), `UI-UX-002 tone ${tone}`);
  }
  assert.ok(statusSrc.includes("showDot"), "UI-UX-002 showDot");
  const dash = read("src/app/admin/page.tsx");
  assert.ok(dash.includes("StatusBadge"), "UI-UX-002 dashboard uses StatusBadge");
  assert.ok(
    !dash.includes('from "@/components/ui/badge"'),
    "UI-UX-002 dashboard not raw Badge for presence",
  );
  console.log("  UI-UX-002 PASS");

  // UI-UX-003 — TypeBadge kinds
  const kinds: MediaTypeKind[] = [
    "IMAGE",
    "VIDEO",
    "GIF",
    "AUDIO",
    "CLOCK",
    "TEXT",
    "NOTICE",
    "EVENT",
    "QR_CODE",
    "EXPERIENCE",
  ];
  for (const k of kinds) {
    assert.equal(resolveMediaTypeKind(k), k, `UI-UX-003 resolve ${k}`);
  }
  assert.equal(resolveMediaTypeKind("image/gif"), "GIF");
  assert.equal(resolveMediaTypeKind("video/mp4"), "VIDEO");
  assert.equal(resolveMediaTypeKind("image/png"), "IMAGE");
  assert.notEqual(resolveMediaTypeKind("CLOCK"), "OTHER");
  const typeSrc = read("src/components/ui/type-badge.tsx");
  assert.ok(typeSrc.includes("CLOCK"), "UI-UX-003 CLOCK in TypeBadge");
  assert.ok(typeSrc.includes("QR_CODE"), "UI-UX-003 QR_CODE");
  console.log("  UI-UX-003 PASS");

  // UI-UX-004 — Sidebar sections
  assert.deepEqual(NAV_SECTION_ORDER, ["OVERVIEW", "MANAGEMENT", "SYSTEM"]);
  const grouped = navGroupedForRole("ADMIN");
  assert.ok(grouped.length >= 2, "UI-UX-004 groups");
  assert.ok(
    grouped.every((g) => g.items.length > 0),
    "UI-UX-004 non-empty sections",
  );
  const hrefs = navForRole("ADMIN").map((i) => i.href);
  assert.ok(hrefs.includes("/admin/devices"));
  assert.ok(hrefs.includes("/admin/users"));
  assert.ok(hrefs.includes("/admin/logs"));
  // routes unchanged from prior nav set
  for (const item of ADMIN_NAV) {
    assert.ok(item.href.startsWith("/admin"), `route ${item.href}`);
  }
  const side = read("src/components/desktop-sidebar.tsx");
  assert.ok(side.includes("navGroupedForRole"), "UI-UX-004 sidebar grouped");
  assert.ok(side.includes("ui-sidebar-section"), "UI-UX-004 section labels");
  console.log("  UI-UX-004 PASS");

  // UI-UX-005 — Dashboard primitives
  assert.ok(dash.includes("PageHeader"), "UI-UX-005 PageHeader");
  assert.ok(dash.includes("StatCard"), "UI-UX-005 StatCard");
  assert.ok(dash.includes("SectionHeader"), "UI-UX-005 SectionHeader");
  assert.ok(!dash.includes("function Stat("), "UI-UX-005 no local Stat");
  console.log("  UI-UX-005 PASS");

  // UI-UX-006 — Devices density
  const devicesPage = read("src/app/admin/devices/page.tsx");
  assert.ok(devicesPage.includes('title="Ecrãs"'), "UI-UX-006 PT title");
  const list = read("src/features/devices/device-list-manager.tsx");
  assert.ok(list.includes("StatusBadge"), "UI-UX-006 StatusBadge");
  assert.ok(list.includes("ui-meta-grid"), "UI-UX-006 meta grid L2");
  assert.ok(list.includes("Ver detalhes"), "UI-UX-006 primary action");
  assert.ok(
    !list.includes("AssignPlaylistForm"),
    "UI-UX-006 assign not on card surface",
  );
  assert.ok(
    !list.includes("LivePresence"),
    "UI-UX-006 diagnostics not on card",
  );
  assert.ok(
    !list.includes("h-16 w-16"),
    "UI-UX-006 no oversized thumb",
  );
  console.log("  UI-UX-006 PASS");

  // UI-UX-007 — Media TypeBadge
  const media = read("src/features/media/media-library.tsx");
  assert.ok(media.includes("TypeBadge"), "UI-UX-007 TypeBadge");
  assert.ok(media.includes("PreviewViewport"), "UI-UX-007 PreviewViewport");
  console.log("  UI-UX-007 PASS");

  // UI-UX-008 — PreviewViewport fixed aspect
  const preview = read("src/components/ui/preview-viewport.tsx");
  assert.ok(preview.includes("aspect-video") || preview.includes("ASPECT_CLASS"));
  assert.ok(preview.includes("overflow-hidden"));
  assert.ok(preview.includes("object-contain"));
  assert.ok(!preview.includes("#070b14"), "UI-UX-008 no hardcoded hex bg");
  const timed = read("src/features/playlists/playlist-timed-preview.tsx");
  assert.ok(timed.includes("PreviewViewport"), "UI-UX-008 playlist uses viewport");
  console.log("  UI-UX-008 PASS");

  // UI-UX-009 — Player cursor idle preserved
  const cursor = read("src/player/runtime/cursor-idle.ts");
  assert.ok(cursor.includes("CursorIdleController") || cursor.includes("idle"));
  assert.ok(existsSync(join(root, "public/tv.js")), "UI-UX-009 tv.js present");
  const playerApp = read("src/features/player/player-app.tsx");
  assert.ok(
    playerApp.includes("cursor") || playerApp.includes("Cursor") || existsSync(join(root, "src/player/runtime/shell.tsx")),
    "UI-UX-009 player shell",
  );
  console.log("  UI-UX-009 PASS");

  // UI-UX-010 — Responsive device grid
  assert.ok(list.includes("md:grid-cols-2"), "UI-UX-010 md 2 cols");
  assert.ok(list.includes("xl:grid-cols-3"), "UI-UX-010 xl 3 cols");
  assert.ok(list.includes("grid-cols-1"), "UI-UX-010 mobile 1 col");
  console.log("  UI-UX-010 PASS");

  // UI-UX-011 — Keyboard / a11y hooks
  assert.ok(side.includes("focus-visible:ring"), "UI-UX-011 sidebar focus");
  assert.ok(side.includes("aria-current") || side.includes("aria-label"));
  const iconBtn = read("src/components/ui/icon-button.tsx");
  assert.ok(iconBtn.includes("aria-label"), "UI-UX-011 IconButton aria-label");
  const assign = read("src/features/devices/assign-playlist-form.tsx");
  assert.ok(assign.includes('aria-label="Seleccionar playlist"'));
  console.log("  UI-UX-011 PASS");

  // UI-UX-012 — Token integrity (aliases, no dark-mode fork required)
  assert.ok(css.includes("--color-text-primary"));
  assert.ok(css.includes("--color-surface"));
  assert.ok(
    css.includes("prefers-reduced-motion"),
    "UI-UX-012 reduced motion",
  );
  console.log("  UI-UX-012 PASS");

  // Docs present
  assert.ok(existsSync(join(root, "docs/UI-UX-01-DESIGN-SYSTEM.md")));
  assert.ok(existsSync(join(root, "docs/evidence/ui-ux-01/AUDIT.md")));

  console.log("UI/UX-01 — ALL CHECKS PASS");
}

main();
