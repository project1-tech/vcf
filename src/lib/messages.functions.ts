import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Per-IP rate limit for admin messages: 3 / 5 minutes
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;
const ipHits = new Map<string, number[]>();

function getClientIp(): string {
  const fwd = getRequestHeader("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = getRequestHeader("x-real-ip");
  if (real) return real.trim();
  const cf = getRequestHeader("cf-connecting-ip");
  if (cf) return cf.trim();
  try {
    return getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    return "unknown";
  }
}

function checkRateLimit(ip: string) {
  const now = Date.now();
  const arr = (ipHits.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (arr.length >= RATE_LIMIT_MAX) {
    const retryIn = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - arr[0]!)) / 1000);
    throw new Error(`Too many messages. Try again in ${retryIn}s.`);
  }
  arr.push(now);
  ipHits.set(ip, arr);
  if (ipHits.size > 5000) {
    for (const [k, v] of ipHits) {
      if (v.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) ipHits.delete(k);
    }
  }
}

export const submitAdminMessage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      kind: z.enum(["download_request", "feature_request"]),
      campaign_id: z.string().uuid().nullable().optional(),
      name: z.string().trim().min(1).max(80),
      phone: z
        .string()
        .trim()
        .regex(/^\+?\d{7,15}$/, "Enter a valid phone number"),
      message: z.string().trim().max(500).optional().default(""),
    }),
  )
  .handler(async ({ data }) => {
    const ip = getClientIp();
    checkRateLimit(ip);

    const phone = data.phone.replace(/\s+/g, "");

    if (data.campaign_id) {
      const { data: campaign } = await supabaseAdmin
        .from("campaigns")
        .select("id")
        .eq("id", data.campaign_id)
        .maybeSingle();
      if (!campaign) throw new Error("Campaign not found");
    }

    const { error } = await supabaseAdmin.from("admin_messages").insert({
      kind: data.kind,
      campaign_id: data.campaign_id ?? null,
      name: data.name.slice(0, 80),
      phone,
      message: (data.message ?? "").slice(0, 500),
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });
