import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useServerFn } from "@tanstack/react-start";
import { adminCampaignAnalytics } from "@/lib/analytics.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Eye, Percent } from "lucide-react";

type AnalyticsResult = {
  series: { day: string; signups: number; views: number }[];
  totals: { signups: number; views: number; conversion: number };
};

export function CampaignAnalytics({
  campaignId,
  password,
}: {
  campaignId: string;
  password: string;
}) {
  const fn = useServerFn(adminCampaignAnalytics);
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (d: number) => {
    setLoading(true);
    try {
      const res = await fn({
        data: { password, campaign_id: campaignId, days: d },
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, days]);

  const series =
    data?.series.map((s) => ({
      ...s,
      label: new Date(s.day).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    })) ?? [];

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border/60 bg-background/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Analytics</h4>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat
          icon={<Users className="h-3.5 w-3.5" />}
          label="Signups"
          value={data?.totals.signups ?? 0}
        />
        <Stat
          icon={<Eye className="h-3.5 w-3.5" />}
          label="Visitors"
          value={data?.totals.views ?? 0}
        />
        <Stat
          icon={<Percent className="h-3.5 w-3.5" />}
          label="Conversion"
          value={`${data?.totals.conversion ?? 0}%`}
        />
      </div>

      <div className="h-56 w-full">
        {loading && !data ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Loading…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={series}
              margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="oklch(0.85 0.04 75)"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "oklch(0.45 0.04 60)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "oklch(0.45 0.04 60)" }}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.985 0.02 85)",
                  border: "1px solid oklch(0.85 0.04 75)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "oklch(0.25 0.04 60)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="views"
                stroke="oklch(0.6 0.13 230)"
                strokeWidth={2}
                dot={false}
                name="Visitors"
              />
              <Line
                type="monotone"
                dataKey="signups"
                stroke="oklch(0.5 0.12 55)"
                strokeWidth={2}
                dot={false}
                name="Signups"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-1 border-border/60 bg-card/60 p-2">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold text-primary">{value}</div>
    </Card>
  );
}
