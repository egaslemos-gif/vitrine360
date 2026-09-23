import { NextRequest } from "next/server";
import { z } from "zod";
import { enforceRateLimit, handleApiError, jsonOk, jsonError } from "@/lib/api";
import {
  bootstrapByActivationCode,
  bootstrapClaim,
  startDevicePairing,
} from "@/services/devices";

const startSchema = z.object({
  action: z.literal("pair_start"),
  clientId: z.string().min(16).max(128),
  pairingSecret: z.string().min(16).max(128),
});
const claimSchema = z.object({
  action: z.literal("claim"),
  deviceId: z.string().uuid(),
  pairingSecret: z.string().min(16).max(128),
});
const pollSchema = z.object({
  action: z.literal("poll"),
  activationCode: z.string().length(6),
});

export async function POST(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, "device-bootstrap", 30, 60_000);
    if (limited) return limited;
    const json = await req.json();
    if (json.action === "pair_start") {
      const body = startSchema.parse(json);
      const result = await startDevicePairing(body);
      return jsonOk(result);
    }
    if (json.action === "poll") {
      const body = pollSchema.parse(json);
      const pending = await bootstrapByActivationCode(body.activationCode);
      if (pending) return jsonOk(pending);
      return jsonError("Activation code not found or already claimed", 404);
    }
    if (json.action === "claim") {
      const body = claimSchema.parse(json);
      const result = await bootstrapClaim(body.deviceId, body.pairingSecret);
      if (result.status === "FORBIDDEN") {
        return jsonError("Forbidden", 403);
      }
      if (result.status === "NOT_FOUND") {
        return jsonError("Not found", 404);
      }
      return jsonOk(result);
    }
    return jsonError("Unknown action", 400);
  } catch (e) {
    return handleApiError(e);
  }
}
