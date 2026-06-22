import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { StarryBg } from "@/components/StarryBg";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { subAdminLogin } from "@/lib/admin.functions";
import { Lock, ShieldCheck } from "lucide-react";

const SUB_KEY = "symoh_sub_admin";
const MAIN_KEY = "symoh_admin_pwd";

export const Route = createFileRoute("/admin/access")({
  head: () => ({ meta: [{ title: "Sub-admin access" }] }),
  component: SubAdminAccess,
});

function SubAdminAccess() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useServerFn(subAdminLogin);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      const res = await login({
        data: {
          subUsername: username.trim(),
          subPassword: password,
        },
      });
      // Clear any conflicting main-admin session
      sessionStorage.removeItem(MAIN_KEY);
      sessionStorage.setItem(
        SUB_KEY,
        JSON.stringify({
          username: res.username,
          password,
          permissions: res.permissions,
        }),
      );
      toast.success(`Welcome, ${res.username}`);
      navigate({ to: "/admin" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StarryBg />
      <Toaster theme="light" position="top-center" />
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-sm border-border/60 bg-card/60 p-6 backdrop-blur">
          <div className="mb-5 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
            <h1 className="mt-2 text-xl font-bold">Sub-admin access</h1>
            <p className="text-xs text-muted-foreground">
              Sign in with the credentials your admin shared.
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sa-username">Username</Label>
              <Input
                id="sa-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sa-password">Password</Label>
              <Input
                id="sa-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[image:var(--gradient-primary)] text-primary-foreground"
            >
              <Lock className="mr-2 h-4 w-4" />
              {loading ? "Verifying…" : "Sign in"}
            </Button>
          </form>
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
