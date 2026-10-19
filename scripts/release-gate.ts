/**
 * Release Gate v1. Reuses existing npm scripts and test files.
 *
 *   npm run release:gate:quick
 *   npm run release:gate
 *   npm run release:gate -- --profile specialized
 *
 * Quick = typecheck, lint, domain, RBAC route guards.
 * Release = quick + production build, playlist atomicity, tenant isolation,
 * workspace RBAC, A-06, and the local manifest tenant test.
 * Specialized = local rollback and cross-process atomicity only.
 * Remote databases, Turso, deploy, and OAuth are never invoked.
 *
 * SQLite files and the Markdown report go to the OS temp directory.
 */
import { spawnSync } from "node:child_process";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Status = "PASS" | "FAIL" | "NOT RUN";
type Profile = "quick" | "release" | "specialized";

type StepResult = {
  id: string;
  title: string;
  command: string;
  required: boolean;
  status: Status;
  ms: number;
  detail: string;
};

const PROFILE = readProfile(process.argv.slice(2));
const ROOT = process.cwd();
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), `v360-release-gate-${STAMP}-`));
const REPORT_DIR = path.join(os.tmpdir(), "vitrine360-release-gate");
const REPORT_PATH = path.join(REPORT_DIR, "RELEASE-GATE-REPORT.md");
const A06_EVIDENCE = path.join("docs", "security", "RBAC-A06-LOCAL-RESULTS.json");
const MF_DB = path.join(ROOT, "data", "mf-tenant-safe.db");

const results: StepResult[] = [];

function readProfile(argv: string[]): Profile {
  const index = argv.indexOf("--profile");
  const value = index >= 0 ? argv[index + 1] : argv.find((item) => item.startsWith("--profile="))?.split("=")[1];
  if (value == null || value === "release") return "release";
  if (value === "quick" || value === "specialized") return value;
  throw new Error(`Unknown profile "${value}". Use quick, release, or specialized.`);
}

function redact(text: string): string {
  return text
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, "%USERPROFILE%")
    .replace(/\/home\/[^/\s]+/g, "/home/%USER%")
    .replace(/libsql:\/\/\S+/gi, "[url]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/Bearer\s+\S+/gi, "[token]")
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[jwt]")
    .replace(/(token|password|secret|authorization)\s*[:=]\s*\S+/gi, "$1=[redacted]");
}

function tail(text: string): string {
  const lines = redact(text).split(/\r?\n/);
  const picked: string[] = [];
  lines.forEach((line, index) => {
    if (!/\berror\b/i.test(line)) return;
    for (let cursor = index - 1; cursor >= 0; cursor--) {
      const candidate = lines[cursor];
      if (!candidate.trim() || /^\s/.test(candidate)) continue;
      if (!picked.includes(candidate)) picked.push(candidate);
      break;
    }
    if (!picked.includes(line)) picked.push(line);
  });
  for (const line of lines.filter((item) => item.trim()).slice(-12)) {
    if (!picked.includes(line)) picked.push(line);
  }
  return picked.slice(-30).join("\n");
}

function git(args: string[]): string {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return (result.stdout ?? "").trim();
}

function localEnv(databaseUrl: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: databaseUrl,
    TURSO_DATABASE_URL: "",
    DATABASE_AUTH_TOKEN: "",
    TURSO_AUTH_TOKEN: "",
    MEDIA_STORAGE_PROVIDER: "local",
  };
}

async function bootstrapSqlite(dbFile: string): Promise<void> {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const client = createClient({ url: `file:${dbFile.replace(/\\/g, "/")}` });
  try {
    const dir = path.join(ROOT, "drizzle");
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) {
      await client.executeMultiple(fs.readFileSync(path.join(dir, file), "utf8"));
    }
    try {
      await client.execute("ALTER TABLE devices ADD COLUMN effective_playback_key text");
    } catch (error) {
      if (!String(error).toLowerCase().includes("duplicate column")) throw error;
    }
  } finally {
    client.close();
  }
}

function runCommand(
  id: string,
  title: string,
  command: string,
  args: string[],
  required: boolean,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): void {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env,
    encoding: "utf8",
    shell: command === "npm",
    timeout: timeoutMs,
    windowsHide: true,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  let status: Status = "FAIL";
  let detail = tail(output);
  if (result.error || result.signal) {
    status = "NOT RUN";
    const code = result.error
      ? ((result.error as NodeJS.ErrnoException).code ?? result.error.name)
      : result.signal;
    detail = tail(`${code}\n${output}`);
  } else if (result.status === 0) {
    status = "PASS";
  }
  if (
    id === "build" &&
    status === "FAIL" &&
    /Symlink/i.test(output) &&
    /node_modules is invalid/i.test(output)
  ) {
    status = "NOT RUN";
    detail =
      "O Turbopack não leu node_modules: a pasta deste worktree é uma junção para fora da raiz. O build de produção não ficou confirmado. Isto não foi contado como erro de compilação.";
  }
  const ms = Date.now() - started;
  results.push({
    id,
    title,
    command: [command, ...args].join(" "),
    required,
    status,
    ms,
    detail,
  });
  console.log(`${status.padEnd(7)} ${id}  ${ms} ms`);
}

function record(id: string, title: string, command: string, required: boolean, status: Status, ms: number, detail: string): void {
  results.push({ id, title, command, required, status, ms, detail: redact(detail) });
  console.log(`${status.padEnd(7)} ${id}  ${ms} ms`);
}

function conclusion(): "PASS" | "FAIL" | "INCOMPLETE" {
  const required = results.filter((step) => step.required);
  if (required.some((step) => step.status === "FAIL")) return "FAIL";
  if (required.some((step) => step.status !== "PASS")) return "INCOMPLETE";
  return "PASS";
}

function writeReport(verdict: "PASS" | "FAIL" | "INCOMPLETE"): void {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const lines = [
    "# Release Gate v1",
    "",
    `Data: ${new Date().toISOString()}`,
    `Perfil: ${PROFILE}`,
    `Branch: ${git(["rev-parse", "--abbrev-ref", "HEAD"])}`,
    `SHA: ${git(["rev-parse", "HEAD"])}`,
    `Conclusão: ${verdict}`,
    "",
    ...results
      .filter((step) => step.required && step.status === "NOT RUN")
      .map((step) => `Etapa obrigatória sem resultado: ${step.id}.`),
    "",
    "PASS significa apenas que os controlos obrigatórios deste perfil terminaram com sucesso. Não autoriza deploy e não cobre dispositivos físicos nem concorrência remota.",
    "",
    "## Etapas",
    "",
    "| Etapa | Obrigatória | Comando | Resultado | Duração |",
    "| --- | --- | --- | --- | --- |",
    ...results.map(
      (step) =>
        `| ${step.id} | ${step.required ? "sim" : "não"} | \`${step.command}\` | ${step.status} | ${step.ms} ms |`,
    ),
    "",
    "## Detalhe",
    "",
  ];
  for (const step of results) {
    lines.push(`### ${step.id} — ${step.status}`, "", step.detail || "(sem saída)", "");
  }
  lines.push("## Estado Git no fim", "", "```", git(["status", "--short", "--branch"]) || "(limpo)", "```", "");
  fs.writeFileSync(REPORT_PATH, lines.join("\n"), "utf8");
}

function evidenceWasClean(): boolean {
  const before = spawnSync("git", ["status", "--porcelain", "--", A06_EVIDENCE], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return (before.stdout ?? "").trim() === "";
}

function restoreA06Evidence(wasClean: boolean): void {
  if (!wasClean) return;
  const after = spawnSync("git", ["status", "--porcelain", "--", A06_EVIDENCE], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if ((after.stdout ?? "").trim() === "") return;
  const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "--", A06_EVIDENCE], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (tracked.status === 0) {
    spawnSync("git", ["checkout", "--", A06_EVIDENCE], { cwd: ROOT });
    return;
  }
  if (fs.existsSync(path.join(ROOT, A06_EVIDENCE))) fs.rmSync(path.join(ROOT, A06_EVIDENCE));
}

function removeManifestDb(existed: Set<string>): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = MF_DB + suffix;
    if (!existed.has(file) && fs.existsSync(file)) fs.rmSync(file, { force: true });
  }
}

async function main(): Promise<number> {
  console.log(`Release Gate v1 — perfil ${PROFILE}`);
  const idleDb = path.join(WORK, "idle.db").replace(/\\/g, "/");
  const safeEnv = localEnv(`file:${idleDb}`);
  const quick = PROFILE === "quick" || PROFILE === "release";
  const release = PROFILE === "release";
  const specialized = PROFILE === "specialized";

  if (quick) {
    runCommand("typecheck", "TypeScript", "npm", ["run", "typecheck"], true, safeEnv, 180_000);
    runCommand("lint", "ESLint", "npm", ["run", "lint"], true, safeEnv, 180_000);
    runCommand("domain", "Regressão de domínio", "npm", ["run", "test:domain"], true, safeEnv, 60_000);
    runCommand("rbac-guards", "Guardas estáticas RBAC", "npm", ["run", "test:rbac-guards"], true, safeEnv, 60_000);
  }

  if (release) {
    runCommand("build", "Build de produção", "npm", ["run", "build"], true, safeEnv, 600_000);
    runCommand(
      "atomicity",
      "Atomicidade de playlists",
      process.execPath,
      ["--import", "tsx", "scripts/test-playlist-atomicity.ts"],
      true,
      safeEnv,
      180_000,
    );

    const tenantDb = path.join(WORK, "tenant.db").replace(/\\/g, "/");
    const rbacDb = path.join(WORK, "rbac.db").replace(/\\/g, "/");
    const a06Db = path.join(WORK, "rbac-a06.db").replace(/\\/g, "/");
    let boot = "PASS";
    let bootDetail = "schema local aplicado";
    const bootStarted = Date.now();
    try {
      await bootstrapSqlite(tenantDb);
      await bootstrapSqlite(rbacDb);
      await bootstrapSqlite(a06Db);
    } catch (error) {
      boot = "FAIL";
      bootDetail = tail(String(error));
    }
    record("sqlite-bootstrap", "Schema local para RBAC e tenant", "drizzle/*.sql + ALTER effective_playback_key", false, boot as Status, Date.now() - bootStarted, bootDetail);

    if (boot === "PASS") {
      runCommand("tenant", "Isolamento multi-tenant", "npm", ["run", "test:tenant"], true, localEnv(`file:${tenantDb}`), 180_000);
      runCommand("rbac", "RBAC de workspace", "npm", ["run", "test:rbac"], true, localEnv(`file:${rbacDb}`), 180_000);
      const a06Clean = evidenceWasClean();
      runCommand("rbac-a06", "RBAC cruzado A-06", "npm", ["run", "test:rbac-a06"], true, localEnv(`file:${a06Db}`), 180_000);
      restoreA06Evidence(a06Clean);
    } else {
      for (const [id, title, command] of [
        ["tenant", "Isolamento multi-tenant", "npm run test:tenant"],
        ["rbac", "RBAC de workspace", "npm run test:rbac"],
        ["rbac-a06", "RBAC cruzado A-06", "npm run test:rbac-a06"],
      ] as const) {
        record(id, title, command, true, "NOT RUN", 0, "O schema local não ficou pronto.");
      }
    }

    const mfExisted = new Set(["", "-wal", "-shm"].map((suffix) => MF_DB + suffix).filter((file) => fs.existsSync(file)));
    if (mfExisted.size > 0) {
      record("manifest", "Manifesto e tenant", "npm run test:manifest-tenant-safe", true, "NOT RUN", 0, "Já existe data/mf-tenant-safe.db. O teste apaga esse ficheiro, por isso não foi executado.");
    } else {
      runCommand("manifest", "Manifesto e tenant", "npm", ["run", "test:manifest-tenant-safe"], true, safeEnv, 180_000);
      removeManifestDb(mfExisted);
    }
  }

  if (specialized) {
    runCommand(
      "rollback-gaps",
      "Rollback local com triggers",
      process.execPath,
      ["--import", "tsx", "scripts/test-playlist-atomicity-rollback-gaps.ts"],
      true,
      safeEnv,
      180_000,
    );
    runCommand(
      "multiprocess",
      "Concorrência entre processos locais",
      process.execPath,
      ["--import", "tsx", "scripts/test-playlist-atomicity-multiprocess.ts"],
      true,
      safeEnv,
      180_000,
    );
    record("benchmark", "Benchmark de concorrência", "scripts/test-sqlite-concurrency-benchmark.ts", false, "NOT RUN", 0, "Fora do perfil por duração. Um relatório anterior não conta como execução deste Gate.");
    record("remote", "Turso, OAuth e migração remota", "(não executado)", false, "NOT RUN", 0, "Este Gate não contacta bases remotas nem cria recursos.");
  }

  if (!specialized) {
    record("specialized", "Concorrência entre processos, migração e OAuth", "(perfil specialized)", false, "NOT RUN", 0, "Não faz parte deste perfil. Correr com --profile specialized quando a alteração o justificar.");
  }

  const verdict = conclusion();
  writeReport(verdict);
  console.log(`Conclusão: ${verdict}`);
  console.log(`Relatório: ${REPORT_PATH}`);
  try {
    fs.rmSync(WORK, { recursive: true, force: true });
  } catch {
    // Windows pode reter o ficheiro SQLite. Fica em %TEMP%.
  }
  return verdict === "PASS" ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(redact(String(error)));
    process.exitCode = 1;
  });
