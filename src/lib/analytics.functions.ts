import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

function hashIp(ip: string, salt: string) {
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export const recordPageView = createServerFn({ method: "POST" })
  .inputValidator(z.object({ campaign_id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const ip = getClientIp();
    const ua = getRequestHeader("user-agent") ?? "";
    const ip_hash = hashIp(ip, data.campaign_id);

    // Unique-per-day: ignore conflict (same visitor today)
    await supabaseAdmin
      .from("page_views")
      .insert({
        campaign_id: data.campaign_id,
        ip_hash,
        user_agent: ua.slice(0, 200),
      })
      .select("id")
      .maybeSingle();
    // We intentionally swallow unique-violation errors so repeat visits in
    // the same day don't surface as an error to the visitor.
    return { ok: true };
  });

async function checkPassword(password: string) {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("admin_password")
    .eq("id", 1)
    .single();
  if (!data || data.admin_password !== password) {
    throw new Error("Invalid password");
  }
}

export const adminCampaignAnalytics = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      password: z.string().min(1).max(200),
      campaign_id: z.string().uuid(),
      days: z.number().int().min(7).max(90).default(30),
    }),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const { data: result, error } = await supabaseAdmin.rpc(
      "get_campaign_analytics" as never,
      { _campaign_id: data.campaign_id, _days: data.days } as never,
    );
    if (error) throw new Error(error.message);
    return result as {
      series: { day: string; signups: number; views: number }[];
      totals: { signups: number; views: number; conversion: number };
    };
  });
