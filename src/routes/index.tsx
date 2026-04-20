import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { StarryBg } from "@/components/StarryBg";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { supabase } from "@/integrations/supabase/client";
import { makeSlug } from "@/lib/vcf";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Sparkles, Link2, Shield } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SYMOH Tech VCF — Create your VCF group" },
      {
        name: "description",
        content:
          "Create a shareable VCF campaign in seconds. Share a unique link, collect numbers and download a contact file.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [target, setTarget] = useState(500);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !link.trim()) {
      toast.error("Name and WhatsApp group link are required");
      return;
    }
    setLoading(true);
    const slug = makeSlug(name);
    const { error } = await supabase.from("campaigns").insert({
      slug,
      name: name.trim(),
      description: description.trim() || null,
      whatsapp_link: link.trim(),
      target,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("VCF campaign created!");
    navigate({ to: "/v/$slug", params: { slug } });
  };

  return (
    <>
      <StarryBg />
      <AnnouncementBanner />
      <Toaster theme="light" position="top-center" />
      <div className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <header className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" />
              SYMOH Tech VCF
            </div>
            <h1 className="heading-gradient text-4xl font-bold tracking-tight md:text-5xl">
              Create your VCF group
            </h1>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Fill the form below to generate a unique shareable link. Anyone
              who opens it can add their number and download the VCF.
            </p>
          </header>

          <Card className="border-border/60 bg-card/60 p-6 backdrop-blur md:p-8">
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">VCF / Group name</Label>
                <Input
                  id="name"
                  placeholder="e.g. SYMOH Tech VCF #5"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="A short description shown on the share page"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={300}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="link">WhatsApp group link</Label>
                <Input
                  id="link"
                  type="url"
                  placeholder="https://chat.whatsapp.com/..."
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="target">Target contacts</Label>
                <Input
                  id="target"
                  type="number"
                  min={10}
                  max={5000}
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value) || 500)}
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90"
                size="lg"
              >
                <Link2 className="mr-2 h-4 w-4" />
                {loading ? "Creating..." : "Generate shareable link"}
              </Button>
            </form>
          </Card>

          <div className="mt-8 text-center">
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
            >
              <Shield className="h-3 w-3" />
              Admin
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
