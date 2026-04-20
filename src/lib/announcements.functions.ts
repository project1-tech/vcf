import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Public: list active, non-expired announcements (newest first)
export const listActiveAnnouncements = createServerFn({ method: "GET" })
  .handler(async () => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("id, message, link_url, link_label, expires_at")
      .eq("active", true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    return { announcements: data ?? [] };
  });
