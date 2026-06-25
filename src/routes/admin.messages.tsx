import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { StarryBg } from "@/components/StarryBg";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListMessagesWithUsers,
  adminReplyMessage,
  adminUpdateMessage,
  adminDeleteMessage,
} from "@/lib/admin.functions";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  MessageSquare,
  Radio,
  Send,
  Trash2,
  User as UserIcon,
} from "lucide-react";

type Profile = { id: string; username: string; email: string };
type Msg = {
  id: string;
  kind: "download_request" | "feature_request";
  campaign_id: string | null;
  name: string;
  phone: string;
  message: string;
  admin_reply: string | null;
  replied_at: string | null;
  read_by_user_at: string | null;
  handled: boolean;
  created_at: string;
  user_id: string | null;
  profile: Profile | null;
};

const STORAGE_KEY = "symoh_admin_pwd";
const SUB_KEY = "symoh_sub_admin";

type SubSession = {
  username: string;
  password: string;
  permissions: string[];
};

export const Route = createFileRoute("/admin/messages")({
  head: () => ({ meta: [{ title: "Messages — Admin" }] }),
  component: AdminMessagesPage,
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const sup = sessionStorage.getItem(STORAGE_KEY);
    const sub = sessionStorage.getItem(SUB_KEY);
    if (!sup && !sub) {
      throw redirect({ to: "/admin" });
    }
  },
});

function getCreds(): {
  password?: string;
  subUsername?: string;
  subPassword?: string;
} {
  const pwd = sessionStorage.getItem(STORAGE_KEY);
  if (pwd) return { password: pwd };
  const sub = sessionStorage.getItem(SUB_KEY);
  if (sub) {
    const parsed = JSON.parse(sub) as SubSession;
    return { subUsername: parsed.username, subPassword: parsed.password };
  }
  return {};
}

function AdminMessagesPage() {
  const list = useServerFn(adminListMessagesWithUsers);
  const reply = useServerFn(adminReplyMessage);
  const upMsg = useServerFn(adminUpdateMessage);
  const delMsg = useServerFn(adminDeleteMessage);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "sent" | "replied" | "read">(
    "sent",
  );
  const [liveOn, setLiveOn] = useState(false);

  const refresh = async () => {
    try {
      const res = await list({ data: getCreds() });
      setMessages(res.messages as Msg[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // Realtime: listen for new submissions + read receipts
    const ch = supabase
      .channel("admin-messages-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_messages" },
        () => refresh(),
      )
      .subscribe((status) => {
        setLiveOn(status === "SUBSCRIBED");
      });
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReply = async (id: string) => {
    if (!replyText.trim()) {
      toast.error("Reply cannot be empty");
      return;
    }
    setSending(true);
    try {
      await reply({
        data: { ...getCreds(), id, reply: replyText.trim() },
      });
      toast.success("Reply sent — user will see it in their dashboard.");
      setReplyTo(null);
      setReplyText("");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleHandledToggle = async (m: Msg) => {
    try {
      await upMsg({
        data: { ...getCreds(), id: m.id, handled: !m.handled },
      });
      setMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, handled: !m.handled } : x)),
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this message permanently?")) return;
    try {
      await delMsg({ data: { ...getCreds(), id } });
      setMessages((prev) => prev.filter((m) => m.id !== id));
      toast.success("Deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const statusOf = (m: Msg): "sent" | "replied" | "read" => {
    if (!m.admin_reply) return "sent";
    if (m.read_by_user_at) return "read";
    return "replied";
  };

  const counts = useMemo(() => {
    const c = { sent: 0, replied: 0, read: 0 };
    for (const m of messages) c[statusOf(m)]++;
    return c;
  }, [messages]);

  const filtered = messages.filter((m) =>
    filter === "all" ? true : statusOf(m) === filter,
  );

  const waLink = (phone: string, body: string) => {
    const clean = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
    return `https://wa.me/${clean}?text=${encodeURIComponent(body)}`;
  };

  return (
    <>
      <StarryBg />
      <Toaster theme="light" position="top-center" />
      <div className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="heading-gradient text-3xl font-bold">
                Visitor messages
              </h1>
              <p className="text-sm text-muted-foreground">
                Reply to users — they'll see your reply in their dashboard.
              </p>
            </div>
            <Link
              to="/admin"
              className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
            >
              <ArrowLeft className="mr-2 h-3 w-3" /> Back to admin
            </Link>
          </header>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(
              [
                { key: "sent", label: `Sent (${counts.sent})` },
                { key: "replied", label: `Replied (${counts.replied})` },
                { key: "read", label: `Read (${counts.read})` },
                { key: "all", label: `All (${messages.length})` },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-md px-3 py-1.5 font-medium ${
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-background/50 text-muted-foreground hover:bg-accent"
                }`}
              >
                {f.label}
              </button>
            ))}
            <span
              className={`ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 ${
                liveOn
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground"
              }`}
              title={liveOn ? "Realtime connected" : "Realtime offline"}
            >
              <Radio
                className={`h-3 w-3 ${liveOn ? "animate-pulse" : ""}`}
              />
              {liveOn ? "Live" : "Offline"}
            </span>
            <span className="text-muted-foreground">
              {filtered.length} shown
            </span>
          </div>


          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : filtered.length === 0 ? (
            <Card className="border-border/60 bg-card/60 p-12 text-center text-sm text-muted-foreground">
              No messages.
            </Card>
          ) : (
            <ul className="space-y-3">
              {filtered.map((m) => (
                <li key={m.id}>
                  <Card
                    className={`p-5 ${
                      m.admin_reply
                        ? "border-success/30 bg-success/5"
                        : "border-primary/30 bg-card/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <UserIcon className="h-4 w-4 text-primary" />
                          <span className="font-semibold">
                            {m.profile?.username ?? (
                              <em className="text-muted-foreground">
                                (guest — no account)
                              </em>
                            )}
                          </span>
                          {m.profile?.email && (
                            <span className="text-xs text-muted-foreground">
                              · {m.profile.email}
                            </span>
                          )}
                          <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium uppercase">
                            {m.kind === "download_request"
                              ? "VCF request"
                              : "Notify me"}
                          </span>
                          {(() => {
                            const s = statusOf(m);
                            const cls =
                              s === "sent"
                                ? "bg-amber-100 text-amber-800"
                                : s === "replied"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-emerald-100 text-emerald-800";
                            return (
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}
                              >
                                {s}
                              </span>
                            );
                          })()}
                          <span className="text-xs text-muted-foreground">
                            {new Date(m.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground">
                            Submitted name:
                          </span>{" "}
                          <strong>{m.name}</strong>{" "}
                          <span className="text-muted-foreground">·</span>{" "}
                          <a
                            href={waLink(
                              m.phone,
                              `Hi ${m.name}, regarding your message…`,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {m.phone}
                            <ExternalLink className="ml-1 inline h-3 w-3" />
                          </a>
                        </div>
                        {m.message && (
                          <p className="mt-2 whitespace-pre-wrap rounded bg-background/40 p-3 text-sm">
                            {m.message}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleHandledToggle(m)}
                          title={m.handled ? "Mark new" : "Mark handled"}
                        >
                          <Check
                            className={`h-4 w-4 ${
                              m.handled
                                ? "text-success"
                                : "text-muted-foreground"
                            }`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(m.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {m.admin_reply ? (
                      <div className="mt-3 rounded-md border border-success/30 bg-success/10 p-3">
                        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase text-success">
                          <MessageSquare className="h-3 w-3" />
                          Your reply
                          {m.replied_at && (
                            <span className="font-normal text-muted-foreground">
                              · {new Date(m.replied_at).toLocaleString()}
                            </span>
                          )}
                          {m.read_by_user_at && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
                              Read
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm">
                          {m.admin_reply}
                        </p>
                        <button
                          type="button"
                          className="mt-2 text-xs text-primary hover:underline"
                          onClick={() => {
                            setReplyTo(m.id);
                            setReplyText(m.admin_reply ?? "");
                          }}
                        >
                          Edit reply
                        </button>
                      </div>
                    ) : null}

                    {replyTo === m.id ? (
                      <div className="mt-3 space-y-2 rounded-md border border-primary/30 bg-background/40 p-3">
                        <Label htmlFor={`reply-${m.id}`} className="text-xs">
                          Reply to {m.profile?.username ?? m.name}
                          {!m.profile && (
                            <span className="ml-2 text-destructive">
                              (no account — they won't see this in the
                              dashboard; use WhatsApp instead)
                            </span>
                          )}
                        </Label>
                        <Textarea
                          id={`reply-${m.id}`}
                          rows={4}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          maxLength={2000}
                          placeholder="Type your reply…"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={sending}
                            onClick={() => handleReply(m.id)}
                            className="bg-[image:var(--gradient-primary)] text-primary-foreground"
                          >
                            <Send className="mr-2 h-3 w-3" />
                            {sending ? "Sending…" : "Send reply"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReplyTo(null);
                              setReplyText("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReplyTo(m.id);
                            setReplyText("");
                          }}
                        >
                          <MessageSquare className="mr-2 h-3 w-3" />
                          {m.admin_reply ? "Edit reply" : "Reply"}
                        </Button>
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
