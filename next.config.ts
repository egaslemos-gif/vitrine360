import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

/**
 * This worktree keeps node_modules as a junction to the sibling checkout.
 * Turbopack refuses that link when it points outside the project root.
 * The root is widened only in that case. A normal install, including
 * production, keeps the detected root.
 */
function linkedModulesRoot(projectDir: string): string | undefined {
  const link = path.join(projectDir, "node_modules");
  let real: string;
  try {
    real = fs.realpathSync(link);
  } catch {
    return undefined;
  }
  const project = path.resolve(projectDir);
  const resolved = path.resolve(real);
  if (resolved.toLowerCase() === path.resolve(link).toLowerCase()) return undefined;
  if (resolved.toLowerCase().startsWith(project.toLowerCase() + path.sep)) return undefined;

  const projectParts = project.split(path.sep);
  const modulesParts = resolved.split(path.sep);
  const common: string[] = [];
  for (let i = 0; i < Math.min(projectParts.length, modulesParts.length); i++) {
    if (projectParts[i].toLowerCase() !== modulesParts[i].toLowerCase()) break;
    common.push(projectParts[i]);
  }
  if (common.length < 2) return undefined;
  return common.join(path.sep);
}

const turbopackRoot = linkedModulesRoot(process.cwd());

const nextConfig: NextConfig = {
  ...(turbopackRoot ? { turbopack: { root: turbopackRoot } } : {}),
};

export default nextConfig;
