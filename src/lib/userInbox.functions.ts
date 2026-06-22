import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("admin_messages")
      .select(
        "id, kind, campaign_id, name, phone, message, admin_reply, replied_at, read_by_user_at, created_at, handled",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { messages: data ?? [] };
  });

export const markRepliesRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).max(200) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.ids.length === 0) return { ok: true };
    const { error } = await supabase
      .from("admin_messages")
      .update({ read_by_user_at: new Date().toISOString() })
      .in("id", data.ids)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
