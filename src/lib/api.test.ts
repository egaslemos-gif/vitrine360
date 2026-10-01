import test from "node:test";
import assert from "node:assert/strict";
import { ZodError, z } from "zod";
import { handleApiError } from "./api";
import { AuthError } from "./auth";
import { MembershipError } from "@/services/members";
import { TenantLifecycleError } from "@/services/tenant-lifecycle";
import { EntitlementDeniedError } from "@/services/entitlements";
import { mapApiErrorToUserMessage } from "./api-error-mapping";

/* AUTHZ-DEVICE-02B — handleApiError contract per category:
 * HTTP status + `error` + `code` + payload, and the user message the mapper yields. */

async function run(e: unknown) {
  const origErr = console.error;
  console.error = () => {};
  try {
    const res = handleApiError(e);
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  } finally {
    console.error = origErr;
  }
}

test("handleApiError — categories", async (t) => {
  await t.test("AuthError 401 → AUTHENTICATION_REQUIRED", async () => {
    const r = await run(new AuthError("Unauthorized", 401));
    assert.equal(r.status, 401);
    assert.equal(r.body.error, "AUTHENTICATION_REQUIRED");
    assert.equal(r.body.code, "AUTHENTICATION_REQUIRED");
    assert.equal(r.body.message, "Unauthorized");
  });

  await t.test("AuthError 403 → PERMISSION_DENIED", async () => {
    const r = await run(new AuthError("Forbidden", 403));
    assert.equal(r.status, 403);
    assert.equal(r.body.error, "PERMISSION_DENIED");
    assert.equal(r.body.code, "PERMISSION_DENIED");
    assert.equal(r.body.message, "Forbidden");
    assert.equal("entitlement" in r.body, false);
  });

  await t.test("AuthError 400 keeps legacy human text in `error`", async () => {
    const r = await run(new AuthError("tenantSlug required for this account", 400));
    assert.equal(r.status, 400);
    assert.equal(r.body.error, "tenantSlug required for this account");
    assert.equal(r.body.code, "VALIDATION_ERROR");
  });

  await t.test("EntitlementDeniedError (feature) → ENTITLEMENT_DENIED", async () => {
    const r = await run(new EntitlementDeniedError("devices.enabled", "FEATURE_DISABLED"));
    assert.equal(r.status, 403);
    assert.equal(r.body.error, "ENTITLEMENT_DENIED");
    assert.equal(r.body.code, "ENTITLEMENT_DENIED");
    assert.equal(r.body.entitlement, "devices.enabled");
    assert.equal(r.body.reason, "FEATURE_DISABLED");
  });

  await t.test("EntitlementDeniedError (quota) → QUOTA_EXCEEDED", async () => {
    const r = await run(
      new EntitlementDeniedError("devices.max", "QUOTA_EXCEEDED", 403, "QUOTA_EXCEEDED"),
    );
    assert.equal(r.status, 403);
    assert.equal(r.body.error, "QUOTA_EXCEEDED");
    assert.equal(r.body.code, "QUOTA_EXCEEDED");
    assert.equal(r.body.entitlement, "devices.max");
  });

  await t.test("TenantLifecycleError NOT_OPERABLE → TENANT_SUSPENDED (legacy text kept)", async () => {
    const r = await run(new TenantLifecycleError("Tenant not operable", "NOT_OPERABLE", 403));
    assert.equal(r.status, 403);
    assert.equal(r.body.error, "Tenant not operable");
    assert.equal(r.body.code, "TENANT_SUSPENDED");
    assert.equal(mapApiErrorToUserMessage(r.body, r.status).title, "Espaço de trabalho suspenso");
  });

  await t.test("activation code inválido → ACTIVATION_CODE_INVALID", async () => {
    const r = await run(new Error("Invalid or expired activation code"));
    assert.equal(r.status, 400);
    assert.equal(r.body.error, "ACTIVATION_CODE_INVALID");
    assert.equal(r.body.code, "ACTIVATION_CODE_INVALID");
    assert.equal(r.body.message, "Invalid or expired activation code");
  });

  await t.test("device já registado → DEVICE_ALREADY_REGISTERED", async () => {
    for (const m of ["Device code already in use", "Device already paired"]) {
      const r = await run(new Error(m));
      assert.equal(r.status, 400);
      assert.equal(r.body.error, "DEVICE_ALREADY_REGISTERED");
      assert.equal(r.body.code, "DEVICE_ALREADY_REGISTERED");
      assert.equal(r.body.message, m);
    }
  });

  await t.test("erro desconhecido → INTERNAL_ERROR, sem stack nem detalhe", async () => {
    const r = await run(new Error("boom: secret-db-path /var/x"));
    assert.equal(r.status, 500);
    assert.equal(r.body.code, "INTERNAL_ERROR");
    assert.equal(r.body.error, "Internal server error");
    const raw = JSON.stringify(r.body);
    assert.ok(!raw.includes("secret-db-path") && !raw.includes("stack"));
    assert.equal(mapApiErrorToUserMessage(r.body, r.status).title, "Não foi possível completar a operação");
  });

  await t.test("valor não-Error → INTERNAL_ERROR", async () => {
    const r = await run("string thrown");
    assert.equal(r.status, 500);
    assert.equal(r.body.code, "INTERNAL_ERROR");
  });
});

test("handleApiError — legacy consumers keep human-readable `error`", async (t) => {
  await t.test("Zod: error = joined messages (content-studio-form etc.)", async () => {
    let zerr: ZodError | null = null;
    try {
      z.object({ name: z.string().min(1, "Nome obrigatório") }).parse({ name: "" });
    } catch (e) {
      zerr = e as ZodError;
    }
    const r = await run(zerr);
    assert.equal(r.status, 400);
    assert.equal(r.body.error, "Nome obrigatório");
    assert.equal(r.body.code, "VALIDATION_ERROR");
  });

  await t.test("'direct upload not supported' still matches direct-upload.ts regex", async () => {
    const r = await run(new Error("Direct upload not supported by this storage"));
    assert.equal(r.status, 400);
    assert.match(String(r.body.error), /direct upload not supported/i);
  });

  await t.test("MembershipError text preserved (members-manager)", async () => {
    const r = await run(new MembershipError("Não pode alterar a própria role", 403));
    assert.equal(r.status, 403);
    assert.equal(r.body.error, "Não pode alterar a própria role");
    assert.equal(r.body.code, "MEMBERSHIP_ERROR");
  });

  await t.test("not found / conflict keep text + status", async () => {
    const nf = await run(new Error("Content not found"));
    assert.deepEqual([nf.status, nf.body.error, nf.body.code], [404, "Content not found", "NOT_FOUND"]);
    const cf = await run(new Error("Ficheiro utilizado em playlists"));
    assert.deepEqual([cf.status, cf.body.code], [409, "CONFLICT"]);
    assert.equal(cf.body.error, "Ficheiro utilizado em playlists");
  });

  await t.test("media direct-upload contract: error === QUOTA_EXCEEDED / ENTITLEMENT_DENIED", async () => {
    const q = await run(new EntitlementDeniedError("storage.max", "QUOTA_EXCEEDED", 403, "QUOTA_EXCEEDED"));
    assert.equal(q.body.error, "QUOTA_EXCEEDED");
    const e = await run(new EntitlementDeniedError("storage.enabled", "FEATURE_DISABLED"));
    assert.equal(e.body.error, "ENTITLEMENT_DENIED");
  });
});
