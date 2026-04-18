-- Page views per campaign
CREATE TABLE public.page_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX page_views_unique_per_day
  ON public.page_views (campaign_id, day, ip_hash);
CREATE INDEX idx_page_views_campaign_day
  ON public.page_views (campaign_id, day DESC);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a page view"
ON public.page_views FOR INSERT
TO public
WITH CHECK (true);

-- No SELECT/UPDATE/DELETE for public; admin server functions use service role.

-- Analytics function: returns daily signups + daily unique views for last N days
CREATE OR REPLACE FUNCTION public.get_campaign_analytics(
  _campaign_id UUID,
  _days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH days AS (
    SELECT generate_series(
      (now() AT TIME ZONE 'UTC')::date - (_days - 1),
      (now() AT TIME ZONE 'UTC')::date,
      '1 day'::interval
    )::date AS day
  ),
  signups AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS n
    FROM public.contacts
    WHERE campaign_id = _campaign_id
      AND created_at >= (now() - (_days || ' days')::interval)
    GROUP BY 1
  ),
  views AS (
    SELECT day, COUNT(*) AS n
    FROM public.page_views
    WHERE campaign_id = _campaign_id
      AND day >= (now() AT TIME ZONE 'UTC')::date - (_days - 1)
    GROUP BY 1
  ),
  series AS (
    SELECT
      d.day,
      COALESCE(s.n, 0)::int AS signups,
      COALESCE(v.n, 0)::int AS views
    FROM days d
    LEFT JOIN signups s ON s.day = d.day
    LEFT JOIN views v ON v.day = d.day
    ORDER BY d.day
  )
  SELECT jsonb_build_object(
    'series', COALESCE(jsonb_agg(jsonb_build_object(
      'day', day,
      'signups', signups,
      'views', views
    )), '[]'::jsonb),
    'totals', jsonb_build_object(
      'signups', COALESCE(SUM(signups), 0),
      'views', COALESCE(SUM(views), 0),
      'conversion', CASE
        WHEN COALESCE(SUM(views), 0) = 0 THEN 0
        ELSE ROUND((SUM(signups)::numeric / SUM(views)::numeric) * 100, 2)
      END
    )
  ) INTO result
  FROM series;

  RETURN result;
END;
$$;