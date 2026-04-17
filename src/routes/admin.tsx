import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { StarryBg } from "@/components/StarryBg";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  adminDeleteCampaign,
  adminDeleteContact,
  adminDeleteMessage,
  adminListData,
  adminLogin,
  adminUpdateMessage,
  adminUpdatePinned,
  adminUpdateTarget,
} from "@/lib/admin.functions";
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
} from "lucide-react";

type Campaign = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  whatsapp_link: string;
  target: number;
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

const STORAGE_KEY = "symoh_admin_pwd";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — SYMOH Tech VCF" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);

  const login = useServerFn(adminLogin);
  const listData = useServerFn(adminListData);
  const delContact = useServerFn(adminDeleteContact);
  const delCampaign = useServerFn(adminDeleteCampaign);
  const upTarget = useServerFn(adminUpdateTarget);
  const upPinned = useServerFn(adminUpdatePinned);
  const upMessage = useServerFn(adminUpdateMessage);
  const delMessage = useServerFn(adminDeleteMessage);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pinned, setPinned] = useState<Pinned[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [openCampaign, setOpenCampaign] = useState<string | null>(null);
  const [showHandled, setShowHandled] = useState(false);

  const refresh = async (pwd: string) => {
    try {
      const res = await listData({ data: { password: pwd } });
      setCampaigns(res.campaigns as Campaign[]);
      setContacts(res.contacts as Contact[]);
      setPinned(res.pinned);
      setMessages((res.messages ?? []) as AdminMessage[]);
      setAuthed(true);
    } catch (e) {
      toast.error((e as Error).message);
      sessionStorage.removeItem(STORAGE_KEY);
      setAuthed(false);
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setPassword(saved);
      refresh(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    try {
      await login({ data: { password } });
      sessionStorage.setItem(STORAGE_KEY, password);
      await refresh(password);
      toast.success("Logged in");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthed(false);
    setPassword("");
  };

  const removeContact = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    await delContact({ data: { password, id } });
    setContacts((prev) => prev.filter((c) => c.id !== id));
    toast.success("Contact deleted");
  };

  const removeCampaign = async (id: string) => {
    if (!confirm("Delete this campaign and all its contacts?")) return;
    await delCampaign({ data: { password, id } });
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    setContacts((prev) => prev.filter((c) => c.campaign_id !== id));
    toast.success("Campaign deleted");
  };

  const saveTarget = async (c: Campaign, value: number) => {
    if (!Number.isFinite(value) || value < 1) return;
    await upTarget({ data: { password, id: c.id, target: value } });
    setCampaigns((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, target: value } : x)),
    );
    toast.success("Target updated");
  };

  const updatePin = (i: number, key: "name" | "phone", value: string) => {
    setPinned((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)),
    );
  };

  const addPin = () =>
    setPinned((prev) => [...prev, { name: "", phone: "" }]);

  const removePin = (i: number) =>
    setPinned((prev) => prev.filter((_, idx) => idx !== i));

  const savePinned = async () => {
    const cleaned = pinned
      .map((p) => ({ name: p.name.trim(), phone: p.phone.trim() }))
      .filter((p) => p.name && p.phone);
    try {
      await upPinned({ data: { password, pinned: cleaned } });
      setPinned(cleaned);
      toast.success("Pinned contacts saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!authed) {
    return (
      <>
        <StarryBg />
        <Toaster theme="dark" position="top-center" />
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
              <p className="text-center text-[11px] text-muted-foreground">
                Default password:{" "}
                <code className="text-primary">admin123</code> — change it in
                the database.
              </p>
            </form>
            <div className="mt-4 text-center">
              <Link to="/" className="text-xs text-muted-foreground">
                ← Back to home
              </Link>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <StarryBg />
      <Toaster theme="dark" position="top-center" />
      <div className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="heading-gradient text-3xl font-bold">Admin</h1>
              <p className="text-sm text-muted-foreground">
                Manage VCF campaigns, contacts and pinned numbers.
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout} size="sm">
              <LogOut className="mr-2 h-3 w-3" /> Logout
            </Button>
          </header>

          {/* Pinned */}
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

          {/* Campaigns */}
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
                            /v/{c.slug} · {cContacts.length} contacts
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

                      {isOpen && (
                        <div className="mt-4 border-t border-border/60 pt-3">
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
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeContact(ct.id)}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
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
