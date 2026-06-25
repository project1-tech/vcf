import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { StarryBg } from "@/components/StarryBg";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  adminCreateAnnouncement,
  adminCreateSubAdmin,
  adminDeleteAnnouncement,
  adminDeleteCampaign,
  adminDeleteContact,
  adminDeleteMessage,
  adminDeleteSubAdmin,
  adminListAnnouncements,
  adminListClickLogs,
  adminListData,
  adminListSubAdmins,
  adminLogin,
  adminUpdateAnnouncement,
  adminUpdateDownloadExpiry,
  adminUpdateMessage,
  adminUpdatePinned,
  adminUpdateSubAdmin,
  adminUpdateTarget,
  adminUpdateWhatsappLink,
} from "@/lib/admin.functions";
import { CampaignAnalytics } from "@/components/CampaignAnalytics";
import {
  Trash2,
  Pin,
  Plus,
  ExternalLink,
  LogOut,
  Lock,
  MessageSquare,
  Bell,
  Check,
  Inbox,
  History,
  Megaphone,
  Power,
  Download,
  Copy,
  ShieldCheck,
  UserCog,
  ChevronRight,
} from "lucide-react";

type Campaign = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  whatsapp_link: string;
  target: number;
  download_expires_at: string | null;
};

type Contact = {
  id: string;
  campaign_id: string;
  name: string;
  phone: string;
  created_at: string;
};
type Pinned = { name: string; phone: string };
type AdminMessage = {
  id: string;
  kind: "download_request" | "feature_request";
  campaign_id: string | null;
  name: string;
  phone: string;
  message: string;
  handled: boolean;
  created_at: string;
};
type Announcement = {
  id: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};
type SubAdmin = {
  id: string;
  username: string;
  permissions: string[];
  created_at: string;
};
type Identity =
  | { kind: "super"; permissions: "*" }
  | { kind: "sub"; username: string; permissions: string[] };

const STORAGE_KEY = "symoh_admin_pwd";
const SUB_KEY = "symoh_sub_admin";

const ALL_PERMS = [
  { key: "campaigns", label: "Manage campaigns" },
  { key: "messages", label: "View & reply to messages" },
  { key: "announcements", label: "Manage announcements" },
  { key: "contacts", label: "Delete contacts" },
  { key: "pinned", label: "Manage pinned contacts" },
] as const;

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — SYMOH Tech VCF" }] }),
  component: AdminPage,
});

function AdminPage() {
  const [password, setPassword] = useState("");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(false);

  const login = useServerFn(adminLogin);
  const listData = useServerFn(adminListData);
  const delContact = useServerFn(adminDeleteContact);
  const delCampaign = useServerFn(adminDeleteCampaign);
  const upTarget = useServerFn(adminUpdateTarget);
  const upWhatsapp = useServerFn(adminUpdateWhatsappLink);
  const upDownloadExpiry = useServerFn(adminUpdateDownloadExpiry);
  const upPinned = useServerFn(adminUpdatePinned);
  const upMessage = useServerFn(adminUpdateMessage);
  const delMessage = useServerFn(adminDeleteMessage);
  const listAnnouncementsFn = useServerFn(adminListAnnouncements);
  const createAnnouncementFn = useServerFn(adminCreateAnnouncement);
  const updateAnnouncementFn = useServerFn(adminUpdateAnnouncement);
  const deleteAnnouncementFn = useServerFn(adminDeleteAnnouncement);
  const listSubAdminsFn = useServerFn(adminListSubAdmins);
  const createSubAdminFn = useServerFn(adminCreateSubAdmin);
  const updateSubAdminFn = useServerFn(adminUpdateSubAdmin);
  const deleteSubAdminFn = useServerFn(adminDeleteSubAdmin);
  const listClickLogsFn = useServerFn(adminListClickLogs);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pinned, setPinned] = useState<Pinned[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([]);
  const [clickLogs, setClickLogs] = useState<
    {
      id: string;
      kind: string;
      slug: string | null;
      campaign_id: string | null;
      username: string | null;
      created_at: string;
    }[]
  >([]);
  const [openCampaign, setOpenCampaign] = useState<string | null>(null);
  const [showHandled, setShowHandled] = useState(false);

  // New announcement form
  const [annMsg, setAnnMsg] = useState("");
  const [annUrl, setAnnUrl] = useState("");
  const [annLabel, setAnnLabel] = useState("");
  const [annExpires, setAnnExpires] = useState("");
  const [annSaving, setAnnSaving] = useState(false);

  // New sub-admin form
  const [saUsername, setSaUsername] = useState("");
  const [saPassword, setSaPassword] = useState("");
  const [saPerms, setSaPerms] = useState<string[]>([]);
  const [saSaving, setSaSaving] = useState(false);
  const [lastCreatedSub, setLastCreatedSub] = useState<{
    username: string;
    password: string;
  } | null>(null);

  // Build creds payload for server fns based on which session is active
  const credsBase = useMemo(() => {
    if (identity?.kind === "super") return { password };
    const sub = sessionStorage.getItem(SUB_KEY);
    if (sub) {
      const parsed = JSON.parse(sub) as {
        username: string;
        password: string;
        permissions: string[];
      };
      return { subUsername: parsed.username, subPassword: parsed.password };
    }
    return {};
  }, [identity, password]);

  const can = (perm: string) => {
    if (!identity) return false;
    if (identity.kind === "super") return true;
    return identity.permissions.includes(perm);
  };

  const loadAnnouncements = async () => {
    if (!can("announcements")) return;
    try {
      const r = await listAnnouncementsFn({ data: credsBase });
      setAnnouncements(r.announcements as Announcement[]);
    } catch {
      /* silent */
    }
  };

  const loadSubAdmins = async () => {
    if (identity?.kind !== "super") return;
    try {
      const r = await listSubAdminsFn({ data: credsBase });
      setSubAdmins(r.subAdmins as SubAdmin[]);
    } catch {
      /* silent */
    }
  };

  const loadClickLogs = async () => {
    if (!can("messages")) return;
    try {
      const r = await listClickLogsFn({ data: { ...credsBase, limit: 100 } });
      setClickLogs(r.logs as typeof clickLogs);
    } catch {
      /* silent */
    }
  };

  const refresh = async (
    creds: { password?: string; subUsername?: string; subPassword?: string },
  ) => {
    try {
      const res = await listData({ data: creds });
      setCampaigns(res.campaigns as Campaign[]);
      setContacts(res.contacts as Contact[]);
      setPinned(res.pinned);
      setMessages((res.messages ?? []) as AdminMessage[]);
    } catch (e) {
      toast.error((e as Error).message);
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(SUB_KEY);
      setIdentity(null);
    }
  };

  // Restore session on mount
  useEffect(() => {
    const mainPwd = sessionStorage.getItem(STORAGE_KEY);
    if (mainPwd) {
      setPassword(mainPwd);
      setIdentity({ kind: "super", permissions: "*" });
      return;
    }
    const subRaw = sessionStorage.getItem(SUB_KEY);
    if (subRaw) {
      try {
        const parsed = JSON.parse(subRaw) as {
          username: string;
          permissions: string[];
        };
        setIdentity({
          kind: "sub",
          username: parsed.username,
          permissions: parsed.permissions,
        });
      } catch {
        sessionStorage.removeItem(SUB_KEY);
      }
    }
  }, []);

  // When identity becomes set, load data
  useEffect(() => {
    if (!identity) return;
    refresh(credsBase);
    loadAnnouncements();
    loadSubAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    try {
      await login({ data: { password } });
      sessionStorage.setItem(STORAGE_KEY, password);
      sessionStorage.removeItem(SUB_KEY);
      setIdentity({ kind: "super", permissions: "*" });
      toast.success("Logged in");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(SUB_KEY);
    setIdentity(null);
    setPassword("");
  };

  // ----- Announcements -----
  const submitAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annMsg.trim()) return toast.error("Message is required");
    setAnnSaving(true);
    try {
      await createAnnouncementFn({
        data: {
          ...credsBase,
          message: annMsg.trim(),
          link_url: annUrl.trim() || undefined,
          link_label: annLabel.trim() || undefined,
          expires_at: annExpires ? new Date(annExpires).toISOString() : null,
          active: true,
        },
      });
      setAnnMsg("");
      setAnnUrl("");
      setAnnLabel("");
      setAnnExpires("");
      await loadAnnouncements();
      toast.success("Announcement published");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAnnSaving(false);
    }
  };

  const toggleAnnouncement = async (a: Announcement) => {
    try {
      await updateAnnouncementFn({
        data: { ...credsBase, id: a.id, active: !a.active },
      });
      setAnnouncements((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, active: !a.active } : x)),
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeAnnouncement = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    try {
      await deleteAnnouncementFn({ data: { ...credsBase, id } });
      setAnnouncements((prev) => prev.filter((x) => x.id !== id));
      toast.success("Deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // ----- Contacts / Campaigns -----
  const removeContact = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    try {
      await delContact({ data: { ...credsBase, id } });
      setContacts((prev) => prev.filter((c) => c.id !== id));
      toast.success("Contact deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeCampaign = async (id: string) => {
    if (!confirm("Delete this campaign and all its contacts?")) return;
    try {
      await delCampaign({ data: { ...credsBase, id } });
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      setContacts((prev) => prev.filter((c) => c.campaign_id !== id));
      toast.success("Campaign deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveTarget = async (c: Campaign, value: number) => {
    if (!Number.isFinite(value) || value < 1) return;
    try {
      await upTarget({ data: { ...credsBase, id: c.id, target: value } });
      setCampaigns((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, target: value } : x)),
      );
      toast.success("Target updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveWhatsapp = async (c: Campaign, value: string) => {
    const v = value.trim();
    if (!/^https?:\/\//.test(v))
      return toast.error("Link must start with http:// or https://");
    try {
      await upWhatsapp({
        data: { ...credsBase, id: c.id, whatsapp_link: v },
      });
      setCampaigns((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, whatsapp_link: v } : x)),
      );
      toast.success("WhatsApp link updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const copyDownloadLink = async (slug: string) => {
    const url = `${window.location.origin}/d/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Download link copied");
    } catch {
      toast.error("Copy failed — link: " + url);
    }
  };

  const saveDownloadExpiry = async (c: Campaign, value: string) => {
    const iso = value ? new Date(value).toISOString() : null;
    try {
      await upDownloadExpiry({
        data: { ...credsBase, id: c.id, download_expires_at: iso },
      });
      setCampaigns((prev) =>
        prev.map((x) =>
          x.id === c.id ? { ...x, download_expires_at: iso } : x,
        ),
      );
      toast.success(iso ? "Expiry updated" : "Expiry cleared");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // ----- Pinned -----
  const updatePin = (i: number, key: "name" | "phone", value: string) =>
    setPinned((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)),
    );
  const addPin = () => setPinned((prev) => [...prev, { name: "", phone: "" }]);
  const removePin = (i: number) =>
    setPinned((prev) => prev.filter((_, idx) => idx !== i));
  const savePinned = async () => {
    const cleaned = pinned
      .map((p) => ({ name: p.name.trim(), phone: p.phone.trim() }))
      .filter((p) => p.name && p.phone);
    try {
      await upPinned({ data: { ...credsBase, pinned: cleaned } });
      setPinned(cleaned);
      toast.success("Pinned contacts saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // ----- Messages quick toggles -----
  const toggleHandled = async (m: AdminMessage) => {
    try {
      await upMessage({
        data: { ...credsBase, id: m.id, handled: !m.handled },
      });
      setMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, handled: !m.handled } : x)),
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeMessage = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    try {
      await delMessage({ data: { ...credsBase, id } });
      setMessages((prev) => prev.filter((m) => m.id !== id));
      toast.success("Deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // ----- Sub-admins -----
  const togglePerm = (k: string) =>
    setSaPerms((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );

  const createSubAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(saUsername.trim()))
      return toast.error("Username: 3-30 letters/numbers/underscore");
    if (saPassword.length < 6)
      return toast.error("Password must be at least 6 characters");
    if (saPerms.length === 0)
      return toast.error("Pick at least one permission");
    setSaSaving(true);
    try {
      await createSubAdminFn({
        data: {
          ...credsBase,
          username: saUsername.trim(),
          newPassword: saPassword,
          permissions: saPerms as never,
        },
      });
      setLastCreatedSub({ username: saUsername.trim(), password: saPassword });
      setSaUsername("");
      setSaPassword("");
      setSaPerms([]);
      await loadSubAdmins();
      toast.success("Sub-admin created");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaSaving(false);
    }
  };

  const updateSubAdminPerms = async (sa: SubAdmin, perms: string[]) => {
    try {
      await updateSubAdminFn({
        data: { ...credsBase, id: sa.id, permissions: perms as never },
      });
      setSubAdmins((prev) =>
        prev.map((x) => (x.id === sa.id ? { ...x, permissions: perms } : x)),
      );
      toast.success("Permissions updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const resetSubAdminPassword = async (sa: SubAdmin) => {
    const newPwd = prompt(
      `Set a new password for ${sa.username} (min 6 chars):`,
    );
    if (!newPwd || newPwd.length < 6) return;
    try {
      await updateSubAdminFn({
        data: {
          ...credsBase,
          id: sa.id,
          newPassword: newPwd,
          permissions: sa.permissions as never,
        },
      });
      setLastCreatedSub({ username: sa.username, password: newPwd });
      toast.success("Password updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeSubAdmin = async (sa: SubAdmin) => {
    if (!confirm(`Delete sub-admin ${sa.username}?`)) return;
    try {
      await deleteSubAdminFn({ data: { ...credsBase, id: sa.id } });
      setSubAdmins((prev) => prev.filter((x) => x.id !== sa.id));
      toast.success("Deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const copyAccessLink = async (creds: { username: string; password: string }) => {
    const url = `${window.location.origin}/admin/access`;
    const text = `Sub-admin access for SYMOH Tech VCF\nURL: ${url}\nUsername: ${creds.username}\nPassword: ${creds.password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Access info copied to clipboard");
    } catch {
      toast.error(`Copy failed. ${text}`);
    }
  };

  const waLink = (phone: string, body: string) => {
    const clean = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
    return `https://wa.me/${clean}?text=${encodeURIComponent(body)}`;
  };

  const campaignName = (id: string | null) =>
    campaigns.find((c) => c.id === id)?.name ?? null;

  const renderInbox = (
    title: string,
    icon: React.ReactNode,
    kind: AdminMessage["kind"],
    waBodyFor: (m: AdminMessage) => string,
  ) => {
    const list = messages
      .filter((m) => m.kind === kind)
      .filter((m) => showHandled || !m.handled);
    const unhandled = messages.filter(
      (m) => m.kind === kind && !m.handled,
    ).length;
    return (
      <Card className="border-border/60 bg-card/60 p-6 backdrop-blur">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-lg font-semibold">
              {title}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({unhandled} new)
              </span>
            </h2>
          </div>
        </div>
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No messages
          </p>
        ) : (
          <ul className="space-y-3">
            {list.slice(0, 10).map((m) => {
              const cn = campaignName(m.campaign_id);
              return (
                <li
                  key={m.id}
                  className={`rounded-lg border p-3 ${
                    m.handled
                      ? "border-border/40 bg-background/20 opacity-60"
                      : "border-primary/30 bg-background/40"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{m.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(m.created_at).toLocaleString()}
                        </span>
                        {cn && (
                          <span className="rounded bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
                            {cn}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-sm">
                        <a
                          href={waLink(m.phone, waBodyFor(m))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {m.phone}
                        </a>
                      </div>
                      {m.message && (
                        <p className="mt-2 whitespace-pre-wrap break-words rounded bg-background/40 p-2 text-sm text-muted-foreground">
                          {m.message}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleHandled(m)}
                        title={m.handled ? "Mark as new" : "Mark handled"}
                      >
                        <Check
                          className={`h-4 w-4 ${
                            m.handled ? "text-success" : "text-muted-foreground"
                          }`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMessage(m.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {list.length > 10 && (
          <div className="mt-3 text-center">
            <Link
              to="/admin/messages"
              className="text-xs text-primary hover:underline"
            >
              View all {list.length} →
            </Link>
          </div>
        )}
      </Card>
    );
  };

  // ---------- Login screen ----------
  if (!identity) {
    return (
      <>
        <StarryBg />
        <Toaster theme="light" position="top-center" />
        <div className="flex min-h-screen items-center justify-center px-4">
          <Card className="w-full max-w-sm border-border/60 bg-card/60 p-6 backdrop-blur">
            <div className="mb-4 text-center">
              <Lock className="mx-auto h-8 w-8 text-primary" />
              <h1 className="mt-2 text-xl font-bold">Admin access</h1>
              <p className="text-xs text-muted-foreground">
                Enter the admin password
              </p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pwd">Password</Label>
                <Input
                  id="pwd"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[image:var(--gradient-primary)] text-primary-foreground"
              >
                {loading ? "Checking..." : "Login"}
              </Button>
            </form>
            <div className="mt-4 space-y-2 text-center text-xs">
              <Link
                to="/admin/access"
                className="block text-primary hover:underline"
              >
                I'm a sub-admin →
              </Link>
              <Link to="/" className="block text-muted-foreground">
                ← Back to home
              </Link>
            </div>
          </Card>
        </div>
      </>
    );
  }

  // ---------- Main admin ----------
  return (
    <>
      <StarryBg />
      <Toaster theme="light" position="top-center" />
      <div className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="heading-gradient text-3xl font-bold">Admin</h1>
              <p className="text-sm text-muted-foreground">
                {identity.kind === "super" ? (
                  "Full access"
                ) : (
                  <>
                    Signed in as <strong>{identity.username}</strong> (sub-admin)
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {can("messages") && (
                <Link
                  to="/admin/messages"
                  className="inline-flex items-center rounded-md bg-[image:var(--gradient-primary)] px-3 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
                >
                  <MessageSquare className="mr-2 h-3 w-3" />
                  Messages
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Link>
              )}
              <Button variant="outline" onClick={handleLogout} size="sm">
                <LogOut className="mr-2 h-3 w-3" /> Logout
              </Button>
            </div>
          </header>

          {/* Sub-admins (super only) */}
          {identity.kind === "super" && (
            <Card className="border-border/60 bg-card/60 p-6 backdrop-blur">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold">Sub-admins</h2>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                Create extra logins with limited access. After creating, copy
                the access info and share it privately. They'll sign in at{" "}
                <code className="rounded bg-muted px-1 text-[10px]">
                  /admin/access
                </code>
                .
              </p>

              <form
                onSubmit={createSubAdminSubmit}
                className="space-y-3 rounded-lg border border-border/60 bg-background/30 p-4"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sa-u">Username</Label>
                    <Input
                      id="sa-u"
                      placeholder="e.g. helper1"
                      value={saUsername}
                      onChange={(e) => setSaUsername(e.target.value)}
                      maxLength={30}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sa-p">Password</Label>
                    <Input
                      id="sa-p"
                      type="text"
                      placeholder="min 6 chars"
                      value={saPassword}
                      onChange={(e) => setSaPassword(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Permissions</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ALL_PERMS.map((p) => (
                      <label
                        key={p.key}
                        className="flex cursor-pointer items-center gap-2 rounded border border-border/60 bg-background/30 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={saPerms.includes(p.key)}
                          onChange={() => togglePerm(p.key)}
                          className="h-4 w-4 accent-primary"
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={saSaving}
                  size="sm"
                  className="bg-[image:var(--gradient-primary)] text-primary-foreground"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {saSaving ? "Creating…" : "Create & generate access link"}
                </Button>
              </form>

              {lastCreatedSub && (
                <Card className="mt-4 border-success/40 bg-success/10 p-4">
                  <p className="text-xs font-semibold uppercase text-success">
                    Access link ready
                  </p>
                  <div className="mt-2 space-y-1 break-all text-sm">
                    <div>
                      URL:{" "}
                      <code className="rounded bg-background px-2 py-0.5 text-xs">
                        {typeof window !== "undefined"
                          ? `${window.location.origin}/admin/access`
                          : "/admin/access"}
                      </code>
                    </div>
                    <div>
                      Username: <strong>{lastCreatedSub.username}</strong>
                    </div>
                    <div>
                      Password: <strong>{lastCreatedSub.password}</strong>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => copyAccessLink(lastCreatedSub)}
                      className="bg-[image:var(--gradient-primary)] text-primary-foreground"
                    >
                      <Copy className="mr-1 h-3 w-3" /> Copy access info
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setLastCreatedSub(null)}
                    >
                      Dismiss
                    </Button>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    ⚠️ This password is shown only now. Save it before
                    dismissing.
                  </p>
                </Card>
              )}

              {subAdmins.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {subAdmins.map((sa) => (
                    <li
                      key={sa.id}
                      className="rounded-lg border border-border/60 bg-background/30 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <UserCog className="h-4 w-4 text-primary" />
                          <strong>{sa.username}</strong>
                          <span className="text-xs text-muted-foreground">
                            created{" "}
                            {new Date(sa.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resetSubAdminPassword(sa)}
                          >
                            Reset password
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSubAdmin(sa)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {ALL_PERMS.map((p) => {
                          const has = sa.permissions.includes(p.key);
                          return (
                            <label
                              key={p.key}
                              className="flex cursor-pointer items-center gap-2 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={has}
                                onChange={() => {
                                  const next = has
                                    ? sa.permissions.filter((x) => x !== p.key)
                                    : [...sa.permissions, p.key];
                                  updateSubAdminPerms(sa, next);
                                }}
                                className="h-3.5 w-3.5 accent-primary"
                              />
                              {p.label}
                            </label>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* Announcements */}
          {can("announcements") && (
            <Card className="border-border/60 bg-card/60 p-6 backdrop-blur">
              <div className="mb-4 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold">
                  Site banner announcements
                </h2>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                Active banners pop up at the top of every page. Set an expiry
                to auto-hide.
              </p>

              <form
                onSubmit={submitAnnouncement}
                className="space-y-3 rounded-lg border border-border/60 bg-background/30 p-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="ann-msg">Message</Label>
                  <Input
                    id="ann-msg"
                    placeholder="e.g. New VCF dropping Friday — join now!"
                    value={annMsg}
                    onChange={(e) => setAnnMsg(e.target.value)}
                    maxLength={500}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ann-url">Link URL (optional)</Label>
                    <Input
                      id="ann-url"
                      type="url"
                      placeholder="https://..."
                      value={annUrl}
                      onChange={(e) => setAnnUrl(e.target.value)}
                      maxLength={500}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ann-label">Link label</Label>
                    <Input
                      id="ann-label"
                      placeholder="e.g. Join group"
                      value={annLabel}
                      onChange={(e) => setAnnLabel(e.target.value)}
                      maxLength={40}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ann-exp">Stop showing at (optional)</Label>
                  <Input
                    id="ann-exp"
                    type="datetime-local"
                    value={annExpires}
                    onChange={(e) => setAnnExpires(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={annSaving}
                  className="bg-[image:var(--gradient-primary)] text-primary-foreground"
                  size="sm"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {annSaving ? "Publishing..." : "Publish banner"}
                </Button>
              </form>

              {announcements.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {announcements.map((a) => {
                    const expired =
                      a.expires_at && new Date(a.expires_at) <= new Date();
                    return (
                      <li
                        key={a.id}
                        className={`flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3 text-sm ${
                          a.active && !expired
                            ? "border-primary/30 bg-primary/5"
                            : "border-border/40 bg-background/20 opacity-70"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                a.active && !expired
                                  ? "bg-success/20 text-success"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {expired ? "Expired" : a.active ? "Live" : "Off"}
                            </span>
                            {a.expires_at && (
                              <span className="text-[11px] text-muted-foreground">
                                until{" "}
                                {new Date(a.expires_at).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 break-words font-medium">
                            {a.message}
                          </p>
                          {a.link_url && (
                            <a
                              href={a.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              {a.link_label || a.link_url}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleAnnouncement(a)}
                            title={a.active ? "Turn off" : "Turn on"}
                          >
                            <Power
                              className={`h-4 w-4 ${
                                a.active
                                  ? "text-success"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAnnouncement(a.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}

          {/* Pinned */}
          {can("pinned") && (
            <Card className="border-border/60 bg-card/60 p-6 backdrop-blur">
              <div className="mb-4 flex items-center gap-2">
                <Pin className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold">
                  Pinned contacts (always in every VCF)
                </h2>
              </div>
              <div className="space-y-3">
                {pinned.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="Name"
                      value={p.name}
                      onChange={(e) => updatePin(i, "name", e.target.value)}
                    />
                    <Input
                      placeholder="+254..."
                      value={p.phone}
                      onChange={(e) => updatePin(i, "phone", e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePin(i)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={addPin}>
                  <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
                <Button
                  size="sm"
                  onClick={savePinned}
                  className="bg-[image:var(--gradient-primary)] text-primary-foreground"
                >
                  Save pinned
                </Button>
              </div>
            </Card>
          )}

          {/* Inbox quick view */}
          {can("messages") && (
            <>
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Inbox className="h-4 w-4" />
                  Visitor messages (latest 10)
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={showHandled}
                    onChange={(e) => setShowHandled(e.target.checked)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  Show handled
                </label>
              </div>

              {renderInbox(
                "VCF download requests",
                <MessageSquare className="h-4 w-4 text-primary" />,
                "download_request",
                (m) => {
                  const cn = campaignName(m.campaign_id);
                  return `Hi ${m.name}, here is the VCF${cn ? ` for ${cn}` : ""} you requested. — SYMOH Tech`;
                },
              )}

              {renderInbox(
                "Future VCF subscribers",
                <Bell className="h-4 w-4 text-primary" />,
                "feature_request",
                (m) =>
                  `Hi ${m.name}, a new VCF is ready! Reply if you'd like to receive it. — SYMOH Tech`,
              )}
            </>
          )}

          {/* Campaigns */}
          {can("campaigns") && (
            <Card className="border-border/60 bg-card/60 p-6 backdrop-blur">
              <h2 className="mb-4 text-lg font-semibold">
                Campaigns ({campaigns.length})
              </h2>
              {campaigns.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No campaigns yet
                </p>
              ) : (
                <ul className="space-y-3">
                  {campaigns.map((c) => {
                    const cContacts = contacts.filter(
                      (x) => x.campaign_id === c.id,
                    );
                    const isOpen = openCampaign === c.id;
                    return (
                      <li
                        key={c.id}
                        className="rounded-lg border border-border/60 bg-background/30 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate font-semibold">
                                {c.name}
                              </h3>
                              <Link
                                to="/v/$slug"
                                params={{ slug: c.slug }}
                                className="text-primary"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              /v/{c.slug} · {cContacts.length}/{c.target}{" "}
                              contacts
                              {cContacts.length + pinned.length >= c.target && (
                                <span className="ml-2 rounded bg-success/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-success">
                                  Full
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground">
                              Target
                            </Label>
                            <Input
                              type="number"
                              defaultValue={c.target}
                              className="h-8 w-20"
                              onBlur={(e) =>
                                saveTarget(c, Number(e.target.value))
                              }
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setOpenCampaign(isOpen ? null : c.id)
                              }
                            >
                              {isOpen ? "Hide" : "View"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCampaign(c.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                          <div className="flex items-center gap-2">
                            <Label className="shrink-0 text-xs text-muted-foreground">
                              WA link
                            </Label>
                            <Input
                              defaultValue={c.whatsapp_link}
                              placeholder="https://chat.whatsapp.com/..."
                              className="h-8"
                              onBlur={(e) => {
                                if (e.target.value.trim() !== c.whatsapp_link) {
                                  saveWhatsapp(c, e.target.value);
                                }
                              }}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyDownloadLink(c.slug)}
                            >
                              <Copy className="mr-1 h-3 w-3" /> Copy link
                            </Button>
                            <a
                              href={`/d/${c.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-accent"
                            >
                              <Download className="h-3 w-3" /> Download
                            </a>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Label className="shrink-0 text-xs text-muted-foreground">
                            Download link expires
                          </Label>
                          <Input
                            type="datetime-local"
                            defaultValue={
                              c.download_expires_at
                                ? new Date(c.download_expires_at)
                                    .toISOString()
                                    .slice(0, 16)
                                : ""
                            }
                            className="h-8 w-auto"
                            onBlur={(e) => saveDownloadExpiry(c, e.target.value)}
                          />
                          {c.download_expires_at && (
                            <>
                              <span
                                className={`text-[11px] ${
                                  new Date(c.download_expires_at) <= new Date()
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {new Date(c.download_expires_at) <= new Date()
                                  ? "Expired"
                                  : `until ${new Date(c.download_expires_at).toLocaleString()}`}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => saveDownloadExpiry(c, "")}
                              >
                                Clear
                              </Button>
                            </>
                          )}
                          {!c.download_expires_at && (
                            <span className="text-[11px] text-muted-foreground">
                              No expiry (always available)
                            </span>
                          )}
                        </div>

                        {isOpen && (
                          <div className="mt-4 border-t border-border/60 pt-3">
                            {identity.kind === "super" && (
                              <CampaignAnalytics
                                campaignId={c.id}
                                password={password}
                              />
                            )}
                            <h4 className="mb-2 mt-4 text-sm font-semibold">
                              Contacts ({cContacts.length})
                            </h4>
                            {cContacts.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                No contacts
                              </p>
                            ) : (
                              <ul className="max-h-72 space-y-1 overflow-y-auto">
                                {cContacts.map((ct) => (
                                  <li
                                    key={ct.id}
                                    className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-background/40"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate">{ct.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {ct.phone}
                                      </div>
                                    </div>
                                    {can("contacts") && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeContact(ct.id)}
                                      >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}

          <div className="text-center">
            <Link to="/" className="text-xs text-muted-foreground">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
