/**
 * UI SSoT — TypeBadge MIME/content resolution (no React mount required).
 * Run: npx tsx scripts/test-ui-type-badge.ts
 */
import assert from "node:assert/strict";
import { resolveMediaTypeKind } from "@/components/ui/type-badge";

assert.equal(resolveMediaTypeKind("image/jpeg"), "IMAGE");
assert.equal(resolveMediaTypeKind("image/png"), "IMAGE");
assert.equal(resolveMediaTypeKind("image/gif"), "GIF");
assert.equal(resolveMediaTypeKind("video/mp4"), "VIDEO");
assert.equal(resolveMediaTypeKind("audio/mpeg"), "AUDIO");
assert.equal(resolveMediaTypeKind("application/pdf"), "PDF");
assert.equal(resolveMediaTypeKind("EXPERIENCE"), "EXPERIENCE");
assert.equal(resolveMediaTypeKind("IMAGE"), "IMAGE");
assert.equal(resolveMediaTypeKind("VIDEO"), "VIDEO");
assert.equal(resolveMediaTypeKind("CLOCK"), "OTHER");
assert.equal(resolveMediaTypeKind(""), "OTHER");

console.log("OK ui-type-badge");
