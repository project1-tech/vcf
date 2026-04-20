import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listActiveAnnouncements } from "@/lib/announcements.functions";
import { Megaphone, ExternalLink } from "lucide-react";

type Announcement = {
  id: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
  expires_at: string | null;
};

export function AnnouncementBanner() {
  const fetchFn = useServerFn(listActiveAnnouncements);
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchFn()
        .then((res) => {
          if (!cancelled) setItems(res.announcements as Announcement[]);
        })
        .catch(() => {});
    load();
    // Re-check every 60s so expiry hides the banner without refresh
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [fetchFn]);

  if (items.length === 0) return null;

  return (
    <div className="sticky top-0 z-50 w-full border-b border-primary/30 bg-[image:var(--gradient-primary)] text-primary-foreground shadow-sm">
      <div className="mx-auto flex max-w-4xl flex-col gap-1 px-4 py-2 text-center text-sm md:flex-row md:items-center md:justify-center md:gap-3">
        {items.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center justify-center gap-2"
          >
            <Megaphone className="h-4 w-4 shrink-0" />
            <span className="font-medium">{a.message}</span>
            {a.link_url && (
              <a
                href={a.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 text-xs font-semibold underline-offset-2 hover:bg-white/30"
              >
                {a.link_label || "Open"}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
