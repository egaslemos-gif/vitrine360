/**
 * AUTHZ-DEVICE-02 — Centralized API → User Message mapper.
 *
 * Maps structured error codes emitted by handleApiError (src/lib/api.ts)
 * into human-readable Portuguese messages for the UI layer.
 *
 * Never shows raw technical codes (ENTITLEMENT_DENIED, PERMISSION_DENIED)
 * as the primary user-facing message.
 *
 * The backend remains the authoritative source. This mapper is UX-only.
 */

/** Structured error shape returned by handleApiError. */
export type ApiErrorPayload = {
  error: string;
  code?: string;
  message?: string;
  entitlement?: string;
  reason?: string;
};

/** User-facing error message. */
export type UserErrorMessage = {
  /** Portuguese title for the alert/toast. */
  title: string;
  /** Portuguese description or action hint. */
  message: string;
  /** Whether the user can retry the same action. */
  recoverable: boolean;
  /** Internal technical code preserved for debugging. */
  _code: string;
};

const ERROR_MAP: Record<
  string,
  Omit<UserErrorMessage, "_code">
> = {
  PERMISSION_DENIED: {
    title: "Permissão insuficiente",
    message:
      "O seu perfil não tem permissão para gerir Ecrãs neste espaço de trabalho. Contacte um administrador.",
    recoverable: false,
  },
  AUTHENTICATION_REQUIRED: {
    title: "Sessão expirada",
    message:
      "A sua sessão expirou. Inicie sessão novamente para continuar.",
    recoverable: false,
  },
  ENTITLEMENT_DENIED: {
    title: "Funcionalidade indisponível",
    message:
      "A gestão de Ecrãs não está disponível para este espaço de trabalho. Contacte o administrador da plataforma.",
    recoverable: false,
  },
  QUOTA_EXCEEDED: {
    title: "Limite de Ecrãs atingido",
    message:
      "O espaço de trabalho atingiu o limite de Ecrãs permitido pelo plano actual.",
    recoverable: false,
  },
  TENANT_SUSPENDED: {
    title: "Espaço de trabalho suspenso",
    message:
      "Este espaço de trabalho está temporariamente suspenso. Contacte o suporte.",
    recoverable: false,
  },
  TENANT_ERROR: {
    title: "Erro do espaço de trabalho",
    message:
      "Não foi possível verificar o estado do espaço de trabalho. Tente novamente.",
    recoverable: true,
  },
  ACTIVATION_CODE_INVALID: {
    title: "Código de activação inválido",
    message:
      "O código de activação introduzido não é válido ou já expirou. Verifique o código no ecrã do dispositivo.",
    recoverable: true,
  },
  DEVICE_ALREADY_REGISTERED: {
    title: "Ecrã já associado",
    message:
      "Este código de identificação já está em uso neste espaço de trabalho. Escolha um código diferente.",
    recoverable: true,
  },
  VALIDATION_ERROR: {
    title: "Dados inválidos",
    message:
      "Verifique os dados introduzidos e tente novamente.",
    recoverable: true,
  },
  MEMBERSHIP_ERROR: {
    title: "Erro de associação",
    message:
      "Não foi possível verificar a sua associação ao espaço de trabalho.",
    recoverable: false,
  },
  CONFLICT: {
    title: "Conflito de dados",
    message:
      "O recurso que está a tentar modificar está em uso. Tente novamente.",
    recoverable: true,
  },
  NOT_FOUND: {
    title: "Recurso não encontrado",
    message:
      "O recurso solicitado não foi encontrado.",
    recoverable: false,
  },
  INTERNAL_ERROR: {
    title: "Não foi possível completar a operação",
    message:
      "Ocorreu um erro inesperado. Tente novamente mais tarde.",
    recoverable: true,
  },
};

const FALLBACK: Omit<UserErrorMessage, "_code"> = {
  title: "Não foi possível completar a operação",
  message: "Ocorreu um erro inesperado. Tente novamente.",
  recoverable: true,
};

/**
 * Map an API error response body to a user-facing message.
 *
 * Usage:
 * ```ts
 * const data = await res.json();
 * if (!res.ok) {
 *   const err = mapApiErrorToUserMessage(data, res.status);
 *   setError(err);
 * }
 * ```
 */
export function mapApiErrorToUserMessage(
  payload: ApiErrorPayload | { error?: string } | null | undefined,
  httpStatus?: number,
): UserErrorMessage {
  if (!payload || typeof payload !== "object") {
    return { ...FALLBACK, _code: "UNKNOWN" };
  }

  const p = payload as ApiErrorPayload;
  // Structured `code` wins; `error` may carry legacy human-readable text.
  const code = p.code && ERROR_MAP[p.code] ? p.code : (p.error ?? "");

  // Attempt structured code lookup
  const mapped = ERROR_MAP[code];
  if (mapped) {
    const result: UserErrorMessage = { ...mapped, _code: code };
    // For VALIDATION_ERROR, append the server-supplied detail if safe
    if (
      code === "VALIDATION_ERROR" &&
      (payload as ApiErrorPayload).message
    ) {
      result.message = (payload as ApiErrorPayload).message!;
    }
    return result;
  }

  // Legacy fallback: status-based when code is not in the map
  if (httpStatus === 401) {
    return { ...ERROR_MAP.AUTHENTICATION_REQUIRED!, _code: code || "AUTHENTICATION_REQUIRED" };
  }
  if (httpStatus === 403) {
    return { ...ERROR_MAP.PERMISSION_DENIED!, _code: code || "PERMISSION_DENIED" };
  }
  if (httpStatus === 429) {
    return {
      title: "Demasiados pedidos",
      message: "Aguarde alguns segundos antes de tentar novamente.",
      recoverable: true,
      _code: "RATE_LIMITED",
    };
  }

  return { ...FALLBACK, _code: code || "UNKNOWN" };
}
