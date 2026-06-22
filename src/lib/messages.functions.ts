import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Submit an admin message — REQUIRES a signed-in user. user_id is taken
// from the validated bearer token; client cannot spoof it.
export const submitAdminMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: z.enum(["download_request", "feature_request"]),
      campaign_id: z.string().uuid().nullable().optional(),
      name: z.string().trim().min(1).max(80),
      phone: z
        .string()
        .trim()
        .regex(
          /^\+\d{7,15}$/,
          "Phone must start with + and country code (e.g. +254...)",
        ),
      message: z.string().trim().max(500).optional().default(""),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const phone = data.phone.replace(/\s+/g, "");

    if (data.campaign_id) {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("id")
        .eq("id", data.campaign_id)
        .maybeSingle();
      if (!campaign) throw new Error("Campaign not found");
    }

    const { error } = await supabase.from("admin_messages").insert({
      kind: data.kind,
      campaign_id: data.campaign_id ?? null,
      name: data.name.slice(0, 80),
      phone,
      message: (data.message ?? "").slice(0, 500),
      user_id: userId,
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });
