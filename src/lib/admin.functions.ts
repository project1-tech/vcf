import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ============================================================
//  AUTH SHARED HELPERS
// ============================================================

const AuthFields = {
  password: z.string().min(1).max(200).optional(),
  subUsername: z.string().min(1).max(40).optional(),
  subPassword: z.string().min(1).max(200).optional(),
};

type AuthInput = {
  password?: string;
  subUsername?: string;
  subPassword?: string;
};

type Identity =
  | { kind: "super"; permissions: "*" }
  | { kind: "sub"; id: string; username: string; permissions: string[] };

const ALL_PERMS = [
  "campaigns",
  "messages",
  "announcements",
  "pinned",
  "contacts",
  "subadmins",
] as const;
type Perm = (typeof ALL_PERMS)[number];

async function requireAdmin(
  input: AuthInput,
  requiredPerm?: Perm,
): Promise<Identity> {
  // Super-admin path
  if (input.password) {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("admin_password")
      .eq("id", 1)
      .single();
    if (error || !data) throw new Error("Settings not found");
    if (data.admin_password !== input.password)
      throw new Error("Invalid password");
    return { kind: "super", permissions: "*" };
  }
  // Sub-admin path
  if (input.subUsername && input.subPassword) {
    const { data, error } = await supabaseAdmin.rpc("verify_sub_admin", {
      _username: input.subUsername,
      _password: input.subPassword,
    });
    if (error) throw new Error(error.message);
    if (!data || (Array.isArray(data) && data.length === 0))
      throw new Error("Invalid sub-admin credentials");
    const row = Array.isArray(data) ? data[0] : data;
    const perms: string[] = row.permissions ?? [];
    if (requiredPerm && !perms.includes(requiredPerm))
      throw new Error(`Forbidden: missing permission "${requiredPerm}"`);
    return {
      kind: "sub",
      id: row.id,
      username: row.username,
      permissions: perms,
    };
  }
  throw new Error("Authentication required");
}

// ============================================================
//  LOGIN / WHO-AM-I
// ============================================================

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ password: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    await requireAdmin({ password: data.password });
    return { ok: true, kind: "super", permissions: "*" as const };
  });

export const subAdminLogin = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      subUsername: z.string().min(3).max(40),
      subPassword: z.string().min(1).max(200),
    }),
  )
  .handler(async ({ data }) => {
    const id = await requireAdmin({
      subUsername: data.subUsername,
      subPassword: data.subPassword,
    });
    if (id.kind !== "sub") throw new Error("Unexpected");
    return {
      ok: true,
      kind: "sub" as const,
      username: id.username,
      permissions: id.permissions,
    };
  });

// ============================================================
//  CAMPAIGNS / CONTACTS / TARGET / WHATSAPP / DOWNLOAD EXPIRY
// ============================================================

export const adminListData = createServerFn({ method: "POST" })
  .inputValidator(z.object(AuthFields))
  .handler(async ({ data }) => {
    await requireAdmin(data);
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

export const adminDeleteContact = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ...AuthFields, id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireAdmin(data, "contacts");
    const { error } = await supabaseAdmin
      .from("contacts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteCampaign = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ...AuthFields, id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireAdmin(data, "campaigns");
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
      ...AuthFields,
      id: z.string().uuid(),
      target: z.number().int().min(1).max(100000),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data, "campaigns");
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({ target: data.target })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateWhatsappLink = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      ...AuthFields,
      id: z.string().uuid(),
      whatsapp_link: z
        .string()
        .trim()
        .regex(/^https?:\/\//, "Link must start with http(s)://")
        .max(500),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data, "campaigns");
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({ whatsapp_link: data.whatsapp_link })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateDownloadExpiry = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      ...AuthFields,
      id: z.string().uuid(),
      download_expires_at: z.string().datetime().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data, "campaigns");
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({ download_expires_at: data.download_expires_at })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
//  ANNOUNCEMENTS
// ============================================================

export const adminListAnnouncements = createServerFn({ method: "POST" })
  .inputValidator(z.object(AuthFields))
  .handler(async ({ data }) => {
    await requireAdmin(data, "announcements");
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
      ...AuthFields,
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
    await requireAdmin(data, "announcements");
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
      ...AuthFields,
      id: z.string().uuid(),
      active: z.boolean().optional(),
      expires_at: z.string().datetime().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data, "announcements");
    const patch: { active?: boolean; expires_at?: string | null } = {};
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
  .inputValidator(z.object({ ...AuthFields, id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireAdmin(data, "announcements");
    const { error } = await supabaseAdmin
      .from("announcements")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
//  PINNED
// ============================================================

export const adminUpdatePinned = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      ...AuthFields,
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
    await requireAdmin(data, "pinned");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ pinned_contacts: data.pinned })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
//  MESSAGES (admin-side inbox / reply)
// ============================================================

export const adminListMessagesWithUsers = createServerFn({ method: "POST" })
  .inputValidator(z.object(AuthFields))
  .handler(async ({ data }) => {
    await requireAdmin(data, "messages");
    const { data: messages, error } = await supabaseAdmin
      .from("admin_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const userIds = Array.from(
      new Set((messages ?? []).map((m) => m.user_id).filter(Boolean) as string[]),
    );
    let profiles: { id: string; username: string; email: string }[] = [];
    if (userIds.length > 0) {
      const { data: pr } = await supabaseAdmin
        .from("profiles")
        .select("id, username, email")
        .in("id", userIds);
      profiles = pr ?? [];
    }
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    return {
      messages: (messages ?? []).map((m) => ({
        ...m,
        profile: m.user_id ? (profileById.get(m.user_id) ?? null) : null,
      })),
    };
  });

export const adminReplyMessage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      ...AuthFields,
      id: z.string().uuid(),
      reply: z.string().trim().min(1).max(2000),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data, "messages");
    const { error } = await supabaseAdmin
      .from("admin_messages")
      .update({
        admin_reply: data.reply,
        replied_at: new Date().toISOString(),
        handled: true,
        read_by_user_at: null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateMessage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      ...AuthFields,
      id: z.string().uuid(),
      handled: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data, "messages");
    const { error } = await supabaseAdmin
      .from("admin_messages")
      .update({ handled: data.handled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteMessage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ...AuthFields, id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireAdmin(data, "messages");
    const { error } = await supabaseAdmin
      .from("admin_messages")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Click audit log ----
export const adminListClickLogs = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ...AuthFields, limit: z.number().int().min(1).max(500).optional() }))
  .handler(async ({ data }) => {
    await requireAdmin(data, "messages");
    const limit = data.limit ?? 200;
    const { data: rows, error } = await supabaseAdmin
      .from("admin_click_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    const userIds = Array.from(
      new Set((rows ?? []).map((r) => r.user_id).filter(Boolean) as string[]),
    );
    let profiles: { id: string; username: string }[] = [];
    if (userIds.length > 0) {
      const { data: pr } = await supabaseAdmin
        .from("profiles")
        .select("id, username")
        .in("id", userIds);
      profiles = pr ?? [];
    }
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return {
      logs: (rows ?? []).map((r) => ({
        ...r,
        username: r.user_id ? (byId.get(r.user_id)?.username ?? null) : null,
      })),
    };
  });

// ============================================================
//  SUB-ADMINS
// ============================================================

export const adminListSubAdmins = createServerFn({ method: "POST" })
  .inputValidator(z.object(AuthFields))
  .handler(async ({ data }) => {
    // Only super-admins can manage sub-admins
    const id = await requireAdmin(data);
    if (id.kind !== "super") throw new Error("Forbidden");
    const { data: rows, error } = await supabaseAdmin
      .from("sub_admins")
      .select("id, username, permissions, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { subAdmins: rows ?? [] };
  });

export const adminCreateSubAdmin = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      ...AuthFields,
      username: z.string().regex(/^[a-zA-Z0-9_]{3,30}$/),
      newPassword: z.string().min(6).max(200),
      permissions: z.array(z.enum(ALL_PERMS)).max(10),
    }),
  )
  .handler(async ({ data }) => {
    const id = await requireAdmin(data);
    if (id.kind !== "super") throw new Error("Forbidden");
    const { data: newId, error } = await supabaseAdmin.rpc("create_sub_admin", {
      _username: data.username,
      _password: data.newPassword,
      _permissions: data.permissions,
    });
    if (error) throw new Error(error.message);
    return { ok: true, id: newId };
  });

export const adminUpdateSubAdmin = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      ...AuthFields,
      id: z.string().uuid(),
      newPassword: z.string().max(200).optional(),
      permissions: z.array(z.enum(ALL_PERMS)).max(10),
    }),
  )
  .handler(async ({ data }) => {
    const id = await requireAdmin(data);
    if (id.kind !== "super") throw new Error("Forbidden");
    const { error } = await supabaseAdmin.rpc("update_sub_admin", {
      _id: data.id,
      _password: data.newPassword ?? "",
      _permissions: data.permissions,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteSubAdmin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ...AuthFields, id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const id = await requireAdmin(data);
    if (id.kind !== "super") throw new Error("Forbidden");
    const { error } = await supabaseAdmin
      .from("sub_admins")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
