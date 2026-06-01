import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Download, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildVcf, downloadVcf, type SimpleContact } from "@/lib/vcf";
import { StarryBg } from "@/components/StarryBg";

export const Route = createFileRoute("/d/$slug")({
  loader: async ({ params }) => {
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("id, slug, name")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error || !campaign) throw notFound();
    return { campaign };
  },
  head: () => ({ meta: [{ title: "Downloading VCF…" }] }),
  component: AutoDownloadPage,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <p>VCF not found.</p>
    </div>
  ),
});

function AutoDownloadPage() {
  const { campaign } = Route.useLoaderData();
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: contacts }, { data: pinnedRaw }] = await Promise.all([
        supabase
          .from("contacts")
          .select("name, phone")
          .eq("campaign_id", campaign.id),
        supabase.rpc("get_pinned_contacts"),
      ]);
      const pinned: SimpleContact[] = Array.isArray(pinnedRaw)
        ? (pinnedRaw as SimpleContact[])
        : [];
      const all: SimpleContact[] = [
        ...pinned,
        ...((contacts ?? []) as SimpleContact[]),
      ];
      if (all.length === 0) return;
      const vcf = buildVcf(all);
      downloadVcf(campaign.slug, vcf);
      setCount(all.length);
      setDone(true);
    })();
  }, [campaign.id, campaign.slug]);

  return (
    <>
      <StarryBg />
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md border-border/60 bg-card/60 p-8 text-center backdrop-blur">
          {done ? (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <h1 className="mt-3 text-xl font-bold">VCF downloaded</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {count} contacts saved as <strong>{campaign.slug}.vcf</strong>
              </p>
            </>
          ) : (
            <>
              <Download className="mx-auto h-12 w-12 animate-bounce text-primary" />
              <h1 className="mt-3 text-xl font-bold">Preparing your VCF…</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                The download should start automatically.
              </p>
            </>
          )}
          <div className="mt-6">
            <Link to="/" className="text-xs text-muted-foreground">
              ← Back to home
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
