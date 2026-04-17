import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StarryBg } from "@/components/StarryBg";
import { supabase } from "@/integrations/supabase/client";
import { buildVcf, downloadVcf, maskPhone, type SimpleContact } from "@/lib/vcf";
import { submitContact } from "@/lib/contacts.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  Heart,
  Search,
  Target,
  TrendingUp,
  UserPlus,
  Users,
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
  name: string;
  phone: string;
  created_at: string;
};

export const Route = createFileRoute("/v/$slug")({
  loader: async ({ params }) => {
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("id, slug, name, description, whatsapp_link, target")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error || !campaign) throw notFound();
    return { campaign: campaign as Campaign };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.campaign.name} — SYMOH Tech VCF` },
          {
            name: "description",
            content:
              loaderData.campaign.description ??
              "Join this VCF campaign — add your number and download the contact file.",
          },
          { property: "og:title", content: loaderData.campaign.name },
          {
            property: "og:description",
            content:
              loaderData.campaign.description ??
              "Add your number and get the VCF file.",
          },
        ]
      : [],
  }),
  component: CampaignPage,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-3xl font-bold">VCF not found</h1>
        <p className="mt-2 text-muted-foreground">
          This link is invalid or has been removed.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Create a new VCF
        </Link>
      </div>
    </div>
  ),
});

function CampaignPage() {
  const { campaign } = Route.useLoaderData();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pinned, setPinned] = useState<SimpleContact[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, phone, created_at")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false });
    setContacts((data ?? []) as Contact[]);
  };

  const loadPinned = async () => {
    const { data } = await supabase.rpc("get_pinned_contacts");
    if (Array.isArray(data)) setPinned(data as SimpleContact[]);
  };

  useEffect(() => {
    loadContacts();
    loadPinned();
    const channel = supabase
      .channel(`contacts-${campaign.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "contacts",
          filter: `campaign_id=eq.${campaign.id}`,
        },
        () => loadContacts(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim().replace(/\s+/g, "");
    if (!trimmedName || !trimmedPhone) {
      toast.error("Name and phone are required");
      return;
    }
    if (!/^\+?\d{7,15}$/.test(trimmedPhone)) {
      toast.error("Enter a valid phone number");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("contacts").insert({
      campaign_id: campaign.id,
      name: trimmedName.slice(0, 80),
      phone: trimmedPhone,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setPhone("");
    toast.success("Added! Don't forget to join the WhatsApp group.");
  };

  const handleDownload = () => {
    const all: SimpleContact[] = [
      ...pinned,
      ...contacts.map((c) => ({ name: c.name, phone: c.phone })),
    ];
    if (all.length === 0) {
      toast.error("No contacts yet");
      return;
    }
    const vcf = buildVcf(all);
    downloadVcf(campaign.slug, vcf);
    toast.success(`Downloaded ${all.length} contacts`);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: campaign.name,
          text: campaign.description ?? "Join this VCF",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      }
    } catch {
      // user cancelled
    }
  };

  const total = contacts.length + pinned.length;
  const remaining = Math.max(campaign.target - total, 0);
  const progress = Math.min((total / campaign.target) * 100, 100);

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search),
  );

  return (
    <>
      <StarryBg />
      <Toaster theme="dark" position="top-center" />
      <div className="min-h-screen px-4 py-8 md:py-12">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Header */}
          <header className="text-center">
            <h1 className="heading-gradient text-3xl font-bold tracking-tight md:text-5xl">
              {campaign.name}
            </h1>
            {campaign.description && (
              <p className="mt-3 text-sm text-muted-foreground md:text-base">
                {campaign.description}
              </p>
            )}
          </header>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border/60 bg-card/60 p-4 text-center backdrop-blur">
              <Target className="mx-auto h-5 w-5 text-primary" />
              <div className="mt-1 text-xs text-muted-foreground">Target</div>
              <div className="mt-1 text-2xl font-bold text-primary">
                {campaign.target}
              </div>
            </Card>
            <Card className="border-border/60 bg-card/60 p-4 text-center backdrop-blur">
              <TrendingUp className="mx-auto h-5 w-5 text-info" />
              <div className="mt-1 text-xs text-muted-foreground">Uploaded</div>
              <div className="mt-1 text-2xl font-bold text-info">{total}</div>
            </Card>
            <Card className="border-border/60 bg-card/60 p-4 text-center backdrop-blur">
              <Users className="mx-auto h-5 w-5 text-destructive" />
              <div className="mt-1 text-xs text-muted-foreground">Remaining</div>
              <div className="mt-1 text-2xl font-bold text-destructive">
                {remaining}
              </div>
            </Card>
          </div>

          {/* Progress */}
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-primary">
                {progress.toFixed(1)}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Join group warning */}
          <Card className="border-destructive/40 bg-destructive/10 p-5 text-center backdrop-blur">
            <p className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              THE VCF FILE WILL DROP IN THE GROUP. JOIN OR YOU WILL MISS IT
              <AlertTriangle className="h-4 w-4" />
            </p>
            <a
              href={campaign.whatsapp_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-success px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              style={{ backgroundColor: "oklch(0.72 0.18 150)" }}
            >
              Join WhatsApp Group
              <ExternalLink className="h-4 w-4" />
            </a>
          </Card>

          {/* Add contact form */}
          <Card className="border-border/60 bg-card/60 p-6 backdrop-blur">
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Phone Number</Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  placeholder="+254..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={16}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="w-full font-semibold text-primary-foreground"
                style={{ backgroundColor: "oklch(0.72 0.18 150)" }}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {submitting ? "Adding..." : "Add to VCF"}
              </Button>
            </form>
          </Card>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              variant="outline"
              onClick={handleShare}
              className="border-primary/40 text-primary hover:bg-primary/10"
            >
              Share Link
            </Button>
            <Button
              size="lg"
              onClick={handleDownload}
              className="bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]"
            >
              <Download className="mr-2 h-4 w-4" />
              Download VCF
            </Button>
          </div>

          {/* Contacts list */}
          <Card className="border-border/60 bg-card/60 p-6 backdrop-blur">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold">
                Contacts ({contacts.length})
              </h2>
              <div className="relative md:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {contacts.length === 0
                  ? "No contacts yet. Be the first!"
                  : "No matches"}
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {filtered.slice(0, 200).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 py-3 text-sm"
                  >
                    <Heart className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {maskPhone(c.phone)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {filtered.length > 200 && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Showing 200 of {filtered.length}
              </p>
            )}
          </Card>

          <div className="pt-4 text-center">
            <Link
              to="/"
              className="text-xs text-muted-foreground hover:text-primary"
            >
              ← Create your own VCF
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
