-- Therapist attendance stats
-- Uses normalized completed-order duration:
--   base service duration + valid add-time duration
-- This avoids booking-rate inflation caused by late manual completion.

DROP VIEW IF EXISTS public.v_girl_attendance_stats;
DROP VIEW IF EXISTS public.v_order_normalized_sessions;

CREATE VIEW public.v_order_normalized_sessions AS
WITH valid_add_time AS (
    SELECT
        ote.order_id,
        COALESCE(SUM(ote.duration_minutes), 0)::INTEGER AS add_time_minutes
    FROM public.order_time_extensions ote
    WHERE ote.settlement_status != 'rejected'
    GROUP BY ote.order_id
)
SELECT
    o.id AS order_id,
    o.girl_id,
    o.completed_at,
    GREATEST(
        COALESCE(
            CASE
                WHEN COALESCE(o.service_duration, 0) > 0
                    THEN o.service_duration * 60
            END,
            CASE
                WHEN o.completed_at IS NOT NULL
                 AND o.service_started_at IS NOT NULL
                 AND o.completed_at > o.service_started_at
                    THEN EXTRACT(EPOCH FROM (o.completed_at - o.service_started_at))::BIGINT
            END,
            0
        ) + (COALESCE(vat.add_time_minutes, 0) * 60),
        0
    )::BIGINT AS normalized_duration_seconds,
    COALESCE(vat.add_time_minutes, 0)::INTEGER AS add_time_minutes
FROM public.orders o
LEFT JOIN valid_add_time vat ON vat.order_id = o.id
WHERE o.status = 'completed'
  AND o.completed_at IS NOT NULL
  AND o.girl_id IS NOT NULL;

CREATE VIEW public.v_girl_attendance_stats AS
WITH recent_online_sessions AS (
    SELECT
        gws.girl_id,
        gws.duration_seconds
    FROM public.girl_work_sessions gws
    WHERE gws.session_type = 'online'
      AND gws.ended_at >= NOW() - INTERVAL '30 days'
      AND gws.ended_at <= NOW()
),
online_stats AS (
    SELECT
        ros.girl_id,
        COALESCE(SUM(ros.duration_seconds), 0) AS online_seconds
    FROM recent_online_sessions ros
    GROUP BY ros.girl_id
),
order_stats AS (
    SELECT
        vons.girl_id,
        COUNT(*) AS order_count,
        COALESCE(SUM(vons.normalized_duration_seconds), 0) AS order_duration_seconds
    FROM public.v_order_normalized_sessions vons
    WHERE vons.completed_at >= NOW() - INTERVAL '30 days'
      AND vons.completed_at <= NOW()
    GROUP BY vons.girl_id
)
SELECT
    g.id AS girl_id,
    g.girl_number,
    g.name,
    g.avatar_url,
    g.city_id,
    COALESCE(os.online_seconds, 0) AS online_seconds,
    COALESCE(ords.order_count, 0) AS order_count,
    COALESCE(ords.order_duration_seconds, 0) AS order_duration_seconds,
    CASE
        WHEN COALESCE(os.online_seconds, 0) > 0
            THEN ROUND((COALESCE(ords.order_duration_seconds, 0)::NUMERIC / os.online_seconds::NUMERIC) * 100, 2)
        ELSE 0
    END AS booking_rate_percent,
    CASE
        WHEN COALESCE(os.online_seconds, 0) < 36000 OR COALESCE(ords.order_count, 0) < 2 THEN 'insufficient_data'
        ELSE
            CASE
                WHEN (
                    CASE
                        WHEN COALESCE(os.online_seconds, 0) > 0
                            THEN (COALESCE(ords.order_duration_seconds, 0)::NUMERIC / os.online_seconds::NUMERIC) * 100
                        ELSE 0
                    END >= 40
                    AND COALESCE(ords.order_count, 0) >= 10
                    AND COALESCE(os.online_seconds, 0) >= 180000
                ) THEN 'excellent'
                WHEN (
                    CASE
                        WHEN COALESCE(os.online_seconds, 0) > 0
                            THEN (COALESCE(ords.order_duration_seconds, 0)::NUMERIC / os.online_seconds::NUMERIC) * 100
                        ELSE 0
                    END >= 30
                    AND COALESCE(ords.order_count, 0) >= 5
                    AND COALESCE(os.online_seconds, 0) >= 108000
                ) THEN 'good'
                WHEN (
                    CASE
                        WHEN COALESCE(os.online_seconds, 0) > 0
                            THEN (COALESCE(ords.order_duration_seconds, 0)::NUMERIC / os.online_seconds::NUMERIC) * 100
                        ELSE 0
                    END >= 20
                    AND COALESCE(ords.order_count, 0) >= 3
                ) THEN 'average'
                WHEN (
                    CASE
                        WHEN COALESCE(os.online_seconds, 0) > 0
                            THEN (COALESCE(ords.order_duration_seconds, 0)::NUMERIC / os.online_seconds::NUMERIC) * 100
                        ELSE 0
                    END >= 10
                    OR COALESCE(ords.order_count, 0) >= 2
                ) THEN 'poor'
                ELSE 'very_poor'
            END
    END AS performance_rating
FROM public.girls g
LEFT JOIN online_stats os ON g.id = os.girl_id
LEFT JOIN order_stats ords ON g.id = ords.girl_id
WHERE g.is_verified = true
  AND g.is_blocked = false
ORDER BY booking_rate_percent DESC NULLS LAST;
