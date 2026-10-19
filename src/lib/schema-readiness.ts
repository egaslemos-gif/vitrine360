import { NextResponse } from "next/server";

/** Raised when a required table, column, or unique index is absent. Does not prepare the schema. */
export class SchemaNotReadyError extends Error {
  constructor(message = "schema_not_ready") {
    super(message);
    this.name = "SchemaNotReadyError";
  }
}

/** True when SQLite reports a missing table or column, or the probe rejected the schema. */
export function isUnpreparedSchemaError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (current instanceof SchemaNotReadyError) return true;
    const text =
      current instanceof Error ? current.message : String(current);
    if (/no such table/i.test(text) || /no such column/i.test(text)) return true;
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}

/** Login audit could not be stored. The session is not opened. */
export class AuditWriteError extends Error {
  constructor() {
    super("audit_unavailable");
    this.name = "AuditWriteError";
  }
}

export function isAuditWriteError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (current instanceof AuditWriteError) return true;
    if (current instanceof Error && current.name === "AuditWriteError") return true;
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}

export const SCHEMA_NOT_READY_NOTICE = "A base de dados ainda não está preparada.";
export const AUDIT_UNAVAILABLE_NOTICE =
  "Não foi possível registar o início de sessão. A autenticação não foi concluída.";

/** Operational text only. The original error is not included. */
export function schemaFailureNotice(error: unknown): string | null {
  if (!isUnpreparedSchemaError(error)) return null;
  return SCHEMA_NOT_READY_NOTICE;
}

export function classifySessionRead<T>(loaded: {
  value: T | null;
  notice: string | null;
}): "schema_not_ready" | "anonymous" | "present" {
  if (loaded.notice) return "schema_not_ready";
  if (loaded.value == null) return "anonymous";
  return "present";
}

export async function loadOrSchemaNotice<T>(
  load: () => Promise<T>,
): Promise<{ value: T | null; notice: string | null }> {
  try {
    return { value: await load(), notice: null };
  } catch (error) {
    const notice = schemaFailureNotice(error);
    if (notice) return { value: null, notice };
    throw error;
  }
}

export function schemaNotReadyResponse() {
  return NextResponse.json(
    {
      error: "SCHEMA_NOT_READY",
      code: "SCHEMA_NOT_READY",
      message: SCHEMA_NOT_READY_NOTICE,
    },
    { status: 503 },
  );
}

export function auditUnavailableResponse() {
  return NextResponse.json(
    {
      error: "AUDIT_UNAVAILABLE",
      code: "AUDIT_UNAVAILABLE",
      message: AUDIT_UNAVAILABLE_NOTICE,
    },
    { status: 503 },
  );
}

/** Schema and audit failures stay distinct from an unverified Google token. */
export function classifyAuthFailure(
  error: unknown,
): "schema_not_ready" | "audit_unavailable" | "email_unverified" | "invalid_token" {
  if (isUnpreparedSchemaError(error)) return "schema_not_ready";
  if (isAuditWriteError(error)) return "audit_unavailable";
  const message = error instanceof Error ? error.message : "";
  if (message === "email_unverified") return "email_unverified";
  return "invalid_token";
}
