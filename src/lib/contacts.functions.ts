import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Simple in-memory rate limiter (per worker instance).
// Window: 60s, Max: 5 submissions per IP.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
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
  const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (arr.length >= RATE_LIMIT_MAX) {
    const retryIn = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - arr[0]!)) / 1000);
    throw new Error(`Too many submissions. Try again in ${retryIn}s.`);
  }
  arr.push(now);
  ipHits.set(ip, arr);
  // Opportunistic cleanup
  if (ipHits.size > 5000) {
    for (const [k, v] of ipHits) {
      if (v.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) ipHits.delete(k);
    }
  }
}

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      campaign_id: z.string().uuid(),
      name: z.string().trim().min(1).max(80),
      phone: z
        .string()
        .trim()
        .regex(/^\+\d{7,15}$/, "Phone must start with + and country code (e.g. +254...)"),
    }),
  )
  .handler(async ({ data }) => {
    const ip = getClientIp();
    checkRateLimit(ip);

    const phone = data.phone.replace(/\s+/g, "");

    // Verify campaign exists
    const { data: campaign, error: campaignErr } = await supabaseAdmin
      .from("campaigns")
      .select("id")
      .eq("id", data.campaign_id)
      .maybeSingle();
    if (campaignErr) throw new Error(campaignErr.message);
    if (!campaign) throw new Error("Campaign not found");

    // Duplicate check (also enforced by unique index)
    const { data: existing } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("campaign_id", data.campaign_id)
      .eq("phone", phone)
      .maybeSingle();
    if (existing) throw new Error("This phone number is already in this VCF");

    const { error } = await supabaseAdmin.from("contacts").insert({
      campaign_id: data.campaign_id,
      name: data.name.slice(0, 80),
      phone,
    });
    if (error) {
      if (error.code === "23505") {
        throw new Error("This phone number is already in this VCF");
      }
      throw new Error(error.message);
    }

    return { ok: true };
  });
