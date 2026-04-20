import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function checkPassword(password: string) {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("admin_password")
    .eq("id", 1)
    .single();
  if (error || !data) throw new Error("Settings not found");
  if (data.admin_password !== password) throw new Error("Invalid password");
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ password: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    return { ok: true };
  });

export const adminListData = createServerFn({ method: "POST" })
  .inputValidator(z.object({ password: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const [
      { data: campaigns },
      { data: contacts },
      { data: settings },
      { data: messages },
    ] = await Promise.all([
      supabaseAdmin
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("app_settings")
        .select("pinned_contacts")
        .eq("id", 1)
        .single(),
      supabaseAdmin
        .from("admin_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    return {
      campaigns: campaigns ?? [],
      contacts: contacts ?? [],
      pinned:
        (settings?.pinned_contacts as { name: string; phone: string }[]) ?? [],
      messages: messages ?? [],
    };
  });

export const adminUpdateMessage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      password: z.string().min(1).max(200),
      id: z.string().uuid(),
      handled: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const { error } = await supabaseAdmin
      .from("admin_messages")
      .update({ handled: data.handled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteMessage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ password: z.string().min(1).max(200), id: z.string().uuid() }),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const { error } = await supabaseAdmin
      .from("admin_messages")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteContact = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ password: z.string().min(1).max(200), id: z.string().uuid() }),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const { error } = await supabaseAdmin
      .from("contacts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteCampaign = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ password: z.string().min(1).max(200), id: z.string().uuid() }),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const { error } = await supabaseAdmin
      .from("campaigns")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateTarget = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      password: z.string().min(1).max(200),
      id: z.string().uuid(),
      target: z.number().int().min(1).max(100000),
    }),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({ target: data.target })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Announcements =====
export const adminListAnnouncements = createServerFn({ method: "POST" })
  .inputValidator(z.object({ password: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const { data: rows, error } = await supabaseAdmin
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { announcements: rows ?? [] };
  });

export const adminCreateAnnouncement = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      password: z.string().min(1).max(200),
      message: z.string().trim().min(1).max(500),
      link_url: z
        .string()
        .trim()
        .regex(/^https?:\/\//, "Link must start with http(s)://")
        .max(500)
        .optional()
        .or(z.literal("")),
      link_label: z.string().trim().max(40).optional().or(z.literal("")),
      expires_at: z.string().datetime().nullable().optional(),
      active: z.boolean().default(true),
    }),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const { error } = await supabaseAdmin.from("announcements").insert({
      message: data.message,
      link_url: data.link_url ? data.link_url : null,
      link_label: data.link_label ? data.link_label : null,
      expires_at: data.expires_at ?? null,
      active: data.active,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateAnnouncement = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      password: z.string().min(1).max(200),
      id: z.string().uuid(),
      active: z.boolean().optional(),
      expires_at: z.string().datetime().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const patch: Record<string, unknown> = {};
    if (typeof data.active === "boolean") patch.active = data.active;
    if (data.expires_at !== undefined) patch.expires_at = data.expires_at;
    const { error } = await supabaseAdmin
      .from("announcements")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteAnnouncement = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ password: z.string().min(1).max(200), id: z.string().uuid() }),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const { error } = await supabaseAdmin
      .from("announcements")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdatePinned = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      password: z.string().min(1).max(200),
      pinned: z
        .array(
          z.object({
            name: z.string().min(1).max(80),
            phone: z.string().min(5).max(20),
          }),
        )
        .max(20),
    }),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ pinned_contacts: data.pinned })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
