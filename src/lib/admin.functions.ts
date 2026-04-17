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
