/**
 * Gates HDMI DoD evidence. Does NOT mark hardware PASS without files in
 * docs/evidence/hw-pending/ (png/jpg/mp4) + a filled RESULTS-TEMPLATE.
 *
 * Exit 0 = evidence present enough to review (operator still fills checklist).
 * Exit 2 = blocked — no physical evidence (expected until Box attached).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pendingDir = path.join(root, "docs/evidence/hw-pending");
const template = path.join(pendingDir, "RESULTS-TEMPLATE.md");

const media = fs.existsSync(pendingDir)
  ? fs
      .readdirSync(pendingDir)
      .filter((f) => /\.(png|jpg|jpeg|webp|mp4)$/i.test(f))
  : [];

const templateText = fs.existsSync(template)
  ? fs.readFileSync(template, "utf8")
  : "";

const filledRows = [...templateText.matchAll(/\|\s*([^|]+)\s*\|\s*(PASS|FAIL|KNOWN LIMITATION)\s*\|/gi)].map(
  (m) => ({ item: m[1].trim(), result: m[2].toUpperCase() }),
);

const hasOfflineRebootMention =
  media.some((f) => /reboot|offline/i.test(f)) ||
  filledRows.some(
    (r) =>
      /reboot|offline/i.test(r.item) &&
      (r.result === "PASS" || r.result === "KNOWN LIMITATION"),
  );

const report = {
  pendingMediaCount: media.length,
  pendingMedia: media,
  resultsTemplateFilledRows: filledRows.length,
  filledRows,
  hasOfflineRebootMention,
  dod: media.length === 0 ? "NOT TESTED — blocked on operator Box+HDMI evidence" : "PARTIAL — review + copy into checklist/report",
  next:
    media.length === 0
      ? [
          "Attach Android TV Box → HDMI → Smart TV",
          "Prefer production HTTPS https://vitrine360-psi.vercel.app/player for SW offline reboot — docs/smart-tv-quickstart.md",
          "Pair + npm run hardware:prep",
          "Drop screenshots into docs/evidence/hw-pending/",
          "Fill RESULTS-TEMPLATE.md then update android-tv-checklist.md HARDWARE columns",
        ]
      : [
          "Review media in docs/evidence/hw-pending/",
          "Complete RESULTS-TEMPLATE.md PASS/FAIL rows (offline reboot mandatory)",
          "Update docs/android-tv-checklist.md + HARDWARE-VALIDATION-REPORT.md",
        ],
};

console.log(JSON.stringify(report, null, 2));

if (media.length === 0) {
  process.exitCode = 2;
} else if (!hasOfflineRebootMention) {
  console.error(
    "\nWARN: media present but offline-reboot evidence not clearly named/filled — DoD incomplete.",
  );
  process.exitCode = 2;
}
