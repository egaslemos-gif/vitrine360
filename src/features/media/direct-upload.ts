/** Browser-side direct upload to R2 via prepare → PUT → complete. */

const MAX_UPLOAD_FALLBACK = 52_428_800;

export type DirectUploadAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url?: string;
  checksum?: string;
};

function hexFromBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return hexFromBuffer(digest);
}

async function multipartUpload(file: File): Promise<DirectUploadAsset> {
  const form = new FormData();
  form.set("file", file);
  const res = await fetch("/api/admin/media", {
    method: "POST",
    body: form,
  });
  let data: { id?: string; error?: string; fileName?: string; mimeType?: string; fileSize?: number } = {};
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new Error(
      res.status === 413 || res.status === 0
        ? "Ficheiro demasiado grande para upload via servidor. Configure o storage R2 com CORS."
        : "Resposta inválida do servidor no upload",
    );
  }
  if (!res.ok || !data.id) {
    if (data.error === "ENTITLEMENT_DENIED" || data.error === "QUOTA_EXCEEDED") {
      throw new Error("Plano actual não permite mais carregamentos de ficheiros (limite de armazenamento excedido).");
    }
    throw new Error(data.error ?? "Erro no upload do media");
  }
  return {
    id: data.id,
    fileName: data.fileName ?? file.name,
    mimeType: data.mimeType ?? file.type,
    fileSize: data.fileSize ?? file.size,
  };
}

/**
 * Prefer R2 direct PUT (bypasses Vercel ~4.5MB body limit).
 * Falls back to multipart when the server does not support direct upload (local provider).
 */
export async function uploadMediaFile(file: File): Promise<DirectUploadAsset> {
  if (file.size <= 0) {
    throw new Error("Ficheiro vazio");
  }
  if (file.size > MAX_UPLOAD_FALLBACK) {
    throw new Error(
      `Ficheiro excede o limite de upload (${Math.round(MAX_UPLOAD_FALLBACK / (1024 * 1024))} MB)`,
    );
  }

  const mimeType = file.type || "application/octet-stream";
  let checksum: string;
  try {
    checksum = await sha256Hex(file);
  } catch {
    throw new Error("Não foi possível calcular o checksum do ficheiro");
  }

  const prepareRes = await fetch("/api/admin/media/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType,
      fileSize: file.size,
      checksum,
    }),
  });

  let prepareData: {
    existing?: boolean;
    asset?: DirectUploadAsset;
    assetId?: string;
    uploadUrl?: string;
    mimeType?: string;
    error?: string;
  } = {};
  try {
    prepareData = (await prepareRes.json()) as typeof prepareData;
  } catch {
    throw new Error("Resposta inválida ao preparar o upload");
  }

  if (!prepareRes.ok) {
    const msg = prepareData.error ?? "Erro ao preparar upload";
    if (msg === "ENTITLEMENT_DENIED" || msg === "QUOTA_EXCEEDED") {
      throw new Error("Plano actual não permite mais carregamentos de ficheiros (limite de armazenamento excedido).");
    }
    if (/direct upload not supported/i.test(msg)) {
      return multipartUpload(file);
    }
    throw new Error(msg);
  }

  if (prepareData.existing && prepareData.asset?.id) {
    return prepareData.asset;
  }

  if (!prepareData.assetId || !prepareData.uploadUrl) {
    throw new Error("Prepare não devolveu URL de upload");
  }

  let putRes: Response;
  try {
    const headers: Record<string, string> = {
      "Content-Type": prepareData.mimeType ?? mimeType,
      "Content-Length": String(file.size),
    };
    // Prefer server-required headers from prepare (signed Content-Length).
    const required = (
      prepareData as { requiredHeaders?: Record<string, string> }
    ).requiredHeaders;
    if (required) {
      Object.assign(headers, required);
    }
    putRes = await fetch(prepareData.uploadUrl, {
      method: "PUT",
      headers,
      body: file,
    });
  } catch {
    throw new Error(
      "Falha ao enviar para o storage (CORS ou rede). Verifique CORS no bucket R2.",
    );
  }

  if (!putRes.ok) {
    throw new Error(
      `Falha no upload para o storage (HTTP ${putRes.status}). Verifique CORS no bucket R2.`,
    );
  }

  const completeRes = await fetch("/api/admin/media/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assetId: prepareData.assetId,
      fileName: file.name,
      mimeType: prepareData.mimeType ?? mimeType,
      fileSize: file.size,
      checksum,
    }),
  });

  let completeData: DirectUploadAsset & { error?: string } = {
    id: "",
    fileName: file.name,
    mimeType,
    fileSize: file.size,
  };
  try {
    completeData = (await completeRes.json()) as typeof completeData;
  } catch {
    throw new Error("Resposta inválida ao finalizar o upload");
  }

  if (!completeRes.ok || !completeData.id) {
    throw new Error(completeData.error ?? "Erro ao finalizar o upload");
  }

  return completeData;
}
