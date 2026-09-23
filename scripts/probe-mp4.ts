/**
 * Extract basic MP4 metadata without ffprobe (ftyp/moov/mvhd/stsd).
 * Usage: npx tsx scripts/probe-mp4.ts ./fixtures/hw-sample.mp4
 */
import fs from "node:fs";
import path from "node:path";

function readU32(buf: Buffer, off: number) {
  return buf.readUInt32BE(off);
}

function readU64(buf: Buffer, off: number) {
  const hi = buf.readUInt32BE(off);
  const lo = buf.readUInt32BE(off + 4);
  return hi * 2 ** 32 + lo;
}

type Box = { type: string; start: number; size: number; header: number };

function* iterBoxes(buf: Buffer, start: number, end: number): Generator<Box> {
  let off = start;
  while (off + 8 <= end) {
    let size = readU32(buf, off);
    const type = buf.toString("ascii", off + 4, off + 8);
    let header = 8;
    if (size === 1) {
      if (off + 16 > end) return;
      size = Number(readU64(buf, off + 8));
      header = 16;
    } else if (size === 0) {
      size = end - off;
    }
    if (!Number.isFinite(size) || size < header || off + size > end + 0) {
      return;
    }
    yield { type, start: off, size, header };
    off += size;
  }
}

function findAll(buf: Buffer, start: number, end: number, want: string): Box[] {
  const out: Box[] = [];
  for (const b of iterBoxes(buf, start, end)) {
    if (b.type === want) out.push(b);
    const container = new Set([
      "moov",
      "trak",
      "mdia",
      "minf",
      "stbl",
      "edts",
      "udta",
    ]);
    if (container.has(b.type)) {
      out.push(...findAll(buf, b.start + b.header, b.start + b.size, want));
    }
  }
  return out;
}

function main() {
  const file = path.resolve(process.argv[2] || "fixtures/hw-sample.mp4");
  const buf = fs.readFileSync(file);
  const top = [...iterBoxes(buf, 0, buf.length)];
  const ftyp = top.find((b) => b.type === "ftyp");
  const brand = ftyp
    ? buf.toString("ascii", ftyp.start + 8, ftyp.start + 12)
    : null;
  const moov = top.find((b) => b.type === "moov");
  if (!moov) {
    console.log(JSON.stringify({ file, error: "no moov", bytes: buf.length }, null, 2));
    process.exit(1);
  }

  const mvhd = findAll(buf, moov.start + moov.header, moov.start + moov.size, "mvhd")[0];
  let durationSec: number | null = null;
  if (mvhd) {
    const ver = buf[mvhd.start + mvhd.header];
    const timescale =
      ver === 1
        ? readU32(buf, mvhd.start + mvhd.header + 20)
        : readU32(buf, mvhd.start + mvhd.header + 12);
    const duration =
      ver === 1
        ? readU64(buf, mvhd.start + mvhd.header + 24)
        : readU32(buf, mvhd.start + mvhd.header + 16);
    if (timescale > 0) durationSec = duration / timescale;
  }

  const stsdList = findAll(buf, moov.start + moov.header, moov.start + moov.size, "stsd");
  let codec: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  for (const stsd of stsdList) {
    const body = stsd.start + stsd.header;
    const entryCount = readU32(buf, body + 4);
    let entryOff = body + 8;
    for (let i = 0; i < entryCount; i++) {
      const entrySize = readU32(buf, entryOff);
      const entryType = buf.toString("ascii", entryOff + 4, entryOff + 8);
      if (
        entryType === "avc1" ||
        entryType === "avc3" ||
        entryType === "hev1" ||
        entryType === "hvc1" ||
        entryType === "mp4v" ||
        entryType === "vp09"
      ) {
        codec = entryType;
        width = buf.readUInt16BE(entryOff + 32);
        height = buf.readUInt16BE(entryOff + 34);
        break;
      }
      if (!codec && (entryType === "mp4a" || entryType === "opus")) {
        codec = entryType;
      }
      entryOff += entrySize;
    }
    if (width) break;
  }

  console.log(
    JSON.stringify(
      {
        file,
        bytes: buf.length,
        format: brand ? `mp4 (${brand})` : "mp4",
        codec,
        resolution: width && height ? `${width}x${height}` : null,
        durationSec: durationSec != null ? Number(durationSec.toFixed(3)) : null,
      },
      null,
      2,
    ),
  );
}

main();
