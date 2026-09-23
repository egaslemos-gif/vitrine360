import path from "node:path";

export function resolveMediaRoot(): string {
  const root = process.env.MEDIA_LOCAL_DIR ?? "./uploads";
  if (path.isAbsolute(root)) {
    return path.resolve(/*turbopackIgnore: true*/ root);
  }
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), root);
}

/** Safe join under root; rejects traversal and prefix tricks. */
export function resolveUnderRoot(root: string, key: string): string {
  if (!key || key.includes("\0")) throw new Error("Invalid storage key");
  const normalizedKey = key.replace(/\\/g, "/");
  if (
    normalizedKey.split("/").some((p) => p === ".." || p === "" || p.includes(":"))
  ) {
    throw new Error("Invalid storage key");
  }
  const resolvedRoot = path.resolve(root);
  const full = path.resolve(resolvedRoot, ...normalizedKey.split("/"));
  const sep = path.sep;
  if (full !== resolvedRoot && !full.startsWith(resolvedRoot + sep)) {
    throw new Error("Invalid storage key");
  }
  return full;
}

export function safeFileExtension(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "bin";
  const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : "bin";
  if (!/^[a-z0-9]{1,8}$/.test(ext)) return "bin";
  return ext;
}

export function sniffMime(data: Buffer, fallback: string): string {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    data.length >= 6 &&
    data[0] === 0x47 &&
    data[1] === 0x49 &&
    data[2] === 0x46
  ) {
    return "image/gif";
  }
  if (
    data.length >= 12 &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (data.length >= 12 && data.toString("ascii", 4, 8) === "ftyp") {
    return "video/mp4";
  }
  if (
    data.length >= 4 &&
    data[0] === 0x1a &&
    data[1] === 0x45 &&
    data[2] === 0xdf &&
    data[3] === 0xa3
  ) {
    return "video/webm";
  }
  return fallback;
}
