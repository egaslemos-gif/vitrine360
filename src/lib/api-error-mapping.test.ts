import test from "node:test";
import assert from "node:assert/strict";
import {
  mapApiErrorToUserMessage,
  type ApiErrorPayload,
} from "./api-error-mapping";

/* ────────────────────────────────────────────────────────────────────
 * AUTHZ-DEVICE-02 — Error Mapping unit tests.
 *
 * Validates that every structured error code emitted by handleApiError
 * is mapped to the correct user-facing Portuguese message and never
 * exposes raw technical codes.
 * ──────────────────────────────────────────────────────────────────── */

test("mapApiErrorToUserMessage", async (t) => {
  // ── Caso B: RBAC DENY → PERMISSION_DENIED ──
  await t.test("PERMISSION_DENIED shows permission title", () => {
    const result = mapApiErrorToUserMessage(
      { error: "PERMISSION_DENIED", message: "Forbidden" },
      403,
    );
    assert.equal(result._code, "PERMISSION_DENIED");
    assert.equal(result.title, "Permissão insuficiente");
    assert.ok(result.message.includes("perfil"));
    assert.equal(result.recoverable, false);
  });

  // ── Caso C: Entitlement DENY → ENTITLEMENT_DENIED ──
  await t.test("ENTITLEMENT_DENIED shows entitlement title", () => {
    const result = mapApiErrorToUserMessage(
      {
        error: "ENTITLEMENT_DENIED",
        code: "ENTITLEMENT_DENIED",
        entitlement: "devices.enabled",
        reason: "NO_ACTIVE_PLAN",
      } as ApiErrorPayload,
      403,
    );
    assert.equal(result._code, "ENTITLEMENT_DENIED");
    assert.equal(result.title, "Funcionalidade indisponível");
    assert.ok(!result.message.includes("ENTITLEMENT_DENIED"));
    assert.equal(result.recoverable, false);
  });

  // ── Caso D: Quota EXCEEDED → QUOTA_EXCEEDED ──
  await t.test("QUOTA_EXCEEDED shows quota title", () => {
    const result = mapApiErrorToUserMessage(
      {
        error: "QUOTA_EXCEEDED",
        code: "QUOTA_EXCEEDED",
        entitlement: "devices.max",
        reason: "QUOTA_EXCEEDED",
      } as ApiErrorPayload,
      403,
    );
    assert.equal(result._code, "QUOTA_EXCEEDED");
    assert.equal(result.title, "Limite de Ecrãs atingido");
    assert.ok(!result.message.includes("QUOTA_EXCEEDED"));
    assert.equal(result.recoverable, false);
  });

  // ── Caso E: Tenant SUSPENDED ──
  await t.test("TENANT_SUSPENDED shows suspension title", () => {
    const result = mapApiErrorToUserMessage(
      { error: "TENANT_SUSPENDED", message: "Tenant is not operable" },
      403,
    );
    assert.equal(result._code, "TENANT_SUSPENDED");
    assert.equal(result.title, "Espaço de trabalho suspenso");
    assert.equal(result.recoverable, false);
  });

  // ── Activation code invalid ──
  await t.test("ACTIVATION_CODE_INVALID shows activation title", () => {
    const result = mapApiErrorToUserMessage(
      { error: "ACTIVATION_CODE_INVALID", message: "Invalid or expired activation code" },
      400,
    );
    assert.equal(result._code, "ACTIVATION_CODE_INVALID");
    assert.equal(result.title, "Código de activação inválido");
    assert.equal(result.recoverable, true);
  });

  // ── Device already registered ──
  await t.test("DEVICE_ALREADY_REGISTERED shows already registered title", () => {
    const result = mapApiErrorToUserMessage(
      { error: "DEVICE_ALREADY_REGISTERED", message: "Device code already in use" },
      400,
    );
    assert.equal(result._code, "DEVICE_ALREADY_REGISTERED");
    assert.equal(result.title, "Ecrã já associado");
    assert.equal(result.recoverable, true);
  });

  // ── Validation error ──
  await t.test("VALIDATION_ERROR uses server message", () => {
    const result = mapApiErrorToUserMessage(
      { error: "VALIDATION_ERROR", message: "Use uppercase letters, numbers, hyphens" },
      400,
    );
    assert.equal(result._code, "VALIDATION_ERROR");
    assert.equal(result.title, "Dados inválidos");
    assert.equal(result.message, "Use uppercase letters, numbers, hyphens");
    assert.equal(result.recoverable, true);
  });

  // ── AUTHENTICATION_REQUIRED ──
  await t.test("AUTHENTICATION_REQUIRED shows session expired", () => {
    const result = mapApiErrorToUserMessage(
      { error: "AUTHENTICATION_REQUIRED", message: "Unauthorized" },
      401,
    );
    assert.equal(result._code, "AUTHENTICATION_REQUIRED");
    assert.equal(result.title, "Sessão expirada");
    assert.equal(result.recoverable, false);
  });

  // ── INTERNAL_ERROR ──
  await t.test("INTERNAL_ERROR shows generic fallback", () => {
    const result = mapApiErrorToUserMessage(
      { error: "INTERNAL_ERROR", message: "Internal server error" },
      500,
    );
    assert.equal(result._code, "INTERNAL_ERROR");
    assert.ok(result.title.length > 0);
    assert.equal(result.recoverable, true);
  });

  // ── Null payload fallback ──
  await t.test("null payload uses safe fallback", () => {
    const result = mapApiErrorToUserMessage(null);
    assert.equal(result._code, "UNKNOWN");
    assert.ok(result.title.length > 0);
    assert.equal(result.recoverable, true);
  });

  // ── Unknown code fallback ──
  await t.test("unknown error code with 403 status falls back to PERMISSION_DENIED", () => {
    const result = mapApiErrorToUserMessage(
      { error: "SOMETHING_NEW" },
      403,
    );
    assert.equal(result.title, "Permissão insuficiente");
  });

  // ── Never exposes raw technical codes ──
  await t.test("no mapped title contains raw technical codes", () => {
    const rawCodes = [
      "PERMISSION_DENIED",
      "ENTITLEMENT_DENIED",
      "QUOTA_EXCEEDED",
      "TENANT_SUSPENDED",
      "ACTIVATION_CODE_INVALID",
      "DEVICE_ALREADY_REGISTERED",
      "INTERNAL_ERROR",
    ];
    for (const code of rawCodes) {
      const result = mapApiErrorToUserMessage({ error: code }, 403);
      assert.ok(
        !result.title.includes(code),
        `Title for ${code} must not contain the raw code`,
      );
    }
  });
});
