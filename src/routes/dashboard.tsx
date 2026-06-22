import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { StarryBg } from "@/components/StarryBg";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getMyMessages, markRepliesRead } from "@/lib/userInbox.functions";
import {
  Inbox,
  LogIn,
  LogOut,
  Mail,
  MessageSquare,
  UserPlus,
} from "lucide-react";

type DashboardSearch = { next?: string };

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s: Record<string, unknown>): DashboardSearch => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Dashboard — SYMOH Tech VCF" },
      {
        name: "description",
        content:
          "Sign in to contact admin, request a VCF, and read admin replies.",
      },
    ],
  }),
  component: DashboardPage,
});

const signupSchema = z.object({
  username: z
    .string()
    .regex(/^[a-zA-Z0-9_]{3,30}$/, "3-30 chars, letters/numbers/underscore"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Min 6 characters").max(200),
});

type UserMsg = {
  id: string;
  kind: "download_request" | "feature_request";
  campaign_id: string | null;
  name: string;
  phone: string;
  message: string;
  admin_reply: string | null;
  replied_at: string | null;
  read_by_user_at: string | null;
  created_at: string;
  handled: boolean;
};

function DashboardPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();

  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [user, setUser] = useState<{
    id: string;
    email: string;
    username: string;
  } | null>(null);

  // Forms
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Inbox
  const [messages, setMessages] = useState<UserMsg[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const getInbox = useServerFn(getMyMessages);
  const markRead = useServerFn(markRepliesRead);

  // Load session on mount
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session;
      if (!mounted) return;
      if (s?.user) {
        await loadProfile(s.user.id, s.user.email ?? "");
      }
      setSessionLoaded(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await loadProfile(session.user.id, session.user.email ?? "");
        } else {
          setUser(null);
        }
      },
    );
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfile = async (uid: string, fallbackEmail: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, email")
      .eq("id", uid)
      .maybeSingle();
    setUser({
      id: uid,
      email: data?.email ?? fallbackEmail,
      username: data?.username ?? "user",
    });
  };

  // Load inbox on user change
  useEffect(() => {
    if (!user) return;
    refreshInbox(true);
    const ch = supabase
      .channel(`inbox-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "admin_messages",
          filter: `user_id=eq.${user.id}`,
        },
        () => refreshInbox(false),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const refreshInbox = async (initial: boolean) => {
    if (initial) setLoadingMsgs(true);
    try {
      const res = await getInbox();
      const msgs = res.messages as UserMsg[];
      setMessages(msgs);
      // Toast for new unread replies on login / on update
      const unread = msgs.filter(
        (m) => m.admin_reply && !m.read_by_user_at,
      );
      if (initial && unread.length > 0) {
        toast.success(
          `You have ${unread.length} new ${unread.length === 1 ? "reply" : "replies"} from admin 🎉`,
          { duration: 6000 },
        );
      }
    } catch (e) {
      // silent for inbox
      console.error(e);
    } finally {
      if (initial) setLoadingMsgs(false);
    }
  };

  const unreadIds = useMemo(
    () =>
      messages
        .filter((m) => m.admin_reply && !m.read_by_user_at)
        .map((m) => m.id),
    [messages],
  );

  const handleMarkAllRead = async () => {
    if (unreadIds.length === 0) return;
    try {
      await markRead({ data: { ids: unreadIds } });
      setMessages((prev) =>
        prev.map((m) =>
          unreadIds.includes(m.id)
            ? { ...m, read_by_user_at: new Date().toISOString() }
            : m,
        ),
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ username, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    try {
      // Check username uniqueness (cheap, race-tolerant)
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", parsed.data.username)
        .maybeSingle();
      if (existing) {
        toast.error("Username already taken");
        return;
      }
      const redirectUrl = `${window.location.origin}/dashboard`;
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { username: parsed.data.username },
        },
      });
      if (error) throw error;
      toast.success("Account created — you're signed in.");
      // After auth state fires, redirect if needed
      if (search.next) {
        setTimeout(() => navigate({ to: search.next as never }), 400);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email and password required");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success("Welcome back!");
      if (search.next) {
        setTimeout(() => navigate({ to: search.next as never }), 400);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMessages([]);
    setUser(null);
    router.invalidate();
  };

  if (!sessionLoaded) {
    return (
      <>
        <StarryBg />
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      </>
    );
  }

  // Not signed in → show auth UI
  if (!user) {
    return (
      <>
        <StarryBg />
        <AnnouncementBanner />
        <Toaster theme="light" position="top-center" />
        <div className="flex min-h-screen items-center justify-center px-4 py-10">
          <Card className="w-full max-w-md border-border/60 bg-card/60 p-6 backdrop-blur">
            <div className="mb-5 text-center">
              <Mail className="mx-auto h-8 w-8 text-primary" />
              <h1 className="heading-gradient mt-2 text-2xl font-bold">
                {mode === "signup" ? "Create your account" : "Welcome back"}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {search.next
                  ? "Sign in to continue — you'll be sent back where you left off."
                  : "An account lets you contact admin and read replies."}
              </p>
            </div>

            {mode === "signup" ? (
              <form onSubmit={handleSignUp} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="su-username">Username</Label>
                  <Input
                    id="su-username"
                    placeholder="yourname"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={30}
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-email">Email</Label>
                  <Input
                    id="su-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-password">Password</Label>
                  <Input
                    id="su-password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-[image:var(--gradient-primary)] text-primary-foreground"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {busy ? "Creating…" : "Create account"}
                </Button>
                <p className="pt-1 text-center text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setMode("signin")}
                  >
                    Sign in
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleSignIn} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="si-email">Email</Label>
                  <Input
                    id="si-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="si-password">Password</Label>
                  <Input
                    id="si-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-[image:var(--gradient-primary)] text-primary-foreground"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
                <p className="pt-1 text-center text-xs text-muted-foreground">
                  No account?{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setMode("signup")}
                  >
                    Create one
                  </button>
                </p>
              </form>
            )}

            <div className="mt-5 text-center">
              <Link
                to="/"
                className="text-xs text-muted-foreground hover:text-primary"
              >
                ← Back to home
              </Link>
            </div>
          </Card>
        </div>
      </>
    );
  }

  // Signed in → inbox
  return (
    <>
      <StarryBg />
      <AnnouncementBanner />
      <Toaster theme="light" position="top-center" />
      <div className="min-h-screen px-4 py-8 md:py-12">
        <div className="mx-auto max-w-3xl space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="heading-gradient text-3xl font-bold">
                Hi, {user.username}
              </h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex gap-2">
              <Link
                to="/"
                className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
              >
                ← Home
              </Link>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="mr-2 h-3 w-3" /> Sign out
              </Button>
            </div>
          </header>

          {search.next && (
            <Card className="border-primary/40 bg-primary/5 p-4 text-sm">
              You came from another page.{" "}
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => navigate({ to: search.next as never })}
              >
                Continue where you left off →
              </button>
            </Card>
          )}

          <Card className="border-border/60 bg-card/60 p-6 backdrop-blur">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Inbox className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold">
                  Your messages{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({messages.length})
                  </span>
                </h2>
              </div>
              {unreadIds.length > 0 && (
                <Button size="sm" variant="outline" onClick={handleMarkAllRead}>
                  Mark {unreadIds.length} as read
                </Button>
              )}
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              After sending a message, check back in <strong>24 hours</strong>{" "}
              for an admin reply. New replies show up here automatically.
            </p>

            {loadingMsgs ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                You haven't sent any messages yet. Visit a VCF page and tap{" "}
                <strong>Contact Admin</strong>.
              </p>
            ) : (
              <ul className="space-y-3">
                {messages.map((m) => {
                  const isUnread = m.admin_reply && !m.read_by_user_at;
                  return (
                    <li
                      key={m.id}
                      className={`rounded-lg border p-4 ${
                        isUnread
                          ? "border-primary/60 bg-primary/5"
                          : "border-border/60 bg-background/30"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded bg-muted px-2 py-0.5 font-medium">
                          {m.kind === "download_request"
                            ? "VCF request"
                            : "Notify me"}
                        </span>
                        <span>{new Date(m.created_at).toLocaleString()}</span>
                        {isUnread && (
                          <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                            New reply
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-start gap-2">
                        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <p className="whitespace-pre-wrap text-sm">
                          {m.message || (
                            <em className="text-muted-foreground">
                              (no message — just contact info)
                            </em>
                          )}
                        </p>
                      </div>
                      {m.admin_reply ? (
                        <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                          <div className="mb-1 text-[11px] font-semibold uppercase text-primary">
                            Admin replied
                            {m.replied_at && (
                              <span className="ml-2 font-normal text-muted-foreground">
                                {new Date(m.replied_at).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap text-sm">
                            {m.admin_reply}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs italic text-muted-foreground">
                          Waiting for admin reply — check back in 24hrs.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
