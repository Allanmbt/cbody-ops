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

COMMENT ON VIEW public.v_order_normalized_sessions IS 'Normalized completed-order durations based on service duration plus valid add-time, with fallback to actual completed duration only when service duration snapshot is missing.';

CREATE VIEW public.v_girl_attendance_stats AS
WITH recent_online_sessions AS (
    SELECT
        gws.girl_id,
        gws.duration_seconds
    FROM public.girl_work_sessions gws
    WHERE gws.session_type = 'online'
      AND gws.ended_at >= NOW() - INTERVAL '90 days'
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
    WHERE vons.completed_at >= NOW() - INTERVAL '90 days'
      AND vons.completed_at <= NOW()
    GROUP BY vons.girl_id
),
extension_stats AS (
    SELECT
        o.girl_id,
        ROUND(
            (
                COUNT(*) FILTER (WHERE ext.order_id IS NOT NULL)::NUMERIC
                / NULLIF(COUNT(*)::NUMERIC, 0)
            ) * 100,
            1
        ) AS extension_rate
    FROM public.orders o
    LEFT JOIN (
        SELECT DISTINCT ote.order_id
        FROM public.order_time_extensions ote
        WHERE ote.settlement_status != 'rejected'
    ) ext ON ext.order_id = o.id
    WHERE o.status = 'completed'
      AND o.completed_at >= NOW() - INTERVAL '90 days'
      AND o.completed_at <= NOW()
    GROUP BY o.girl_id
),
arrived_cancel_stats AS (
    SELECT
        o.girl_id,
        COALESCE(COUNT(*), 0) AS arrived_cancelled_count
    FROM public.order_cancellations oc
    INNER JOIN public.orders o ON o.id = oc.order_id
    WHERE oc.cancelled_at >= NOW() - INTERVAL '90 days'
      AND oc.previous_status IN ('arrived', 'in_service')
    GROUP BY o.girl_id
),
repeat_client_stats AS (
    WITH recent_clients AS (
        SELECT DISTINCT o.girl_id, o.user_id
        FROM public.orders o
        WHERE o.status = 'completed'
          AND o.completed_at >= NOW() - INTERVAL '90 days'
          AND o.completed_at <= NOW()
          AND o.user_id IS NOT NULL
    ),
    historical_completed AS (
        SELECT
            o.girl_id,
            o.user_id,
            COUNT(*) AS completed_count
        FROM public.orders o
        WHERE o.status = 'completed'
          AND o.user_id IS NOT NULL
        GROUP BY o.girl_id, o.user_id
    )
    SELECT
        rc.girl_id,
        ROUND(
            (
                COUNT(rc.user_id) FILTER (WHERE hc.completed_count >= 2)::NUMERIC
                / NULLIF(COUNT(rc.user_id)::NUMERIC, 0)
            ) * 100,
            1
        ) AS repeat_client_rate
    FROM recent_clients rc
    LEFT JOIN historical_completed hc
      ON hc.girl_id = rc.girl_id
     AND hc.user_id = rc.user_id
    GROUP BY rc.girl_id
),
favorite_stats AS (
    SELECT
        uf.girl_id,
        COALESCE(SUM(CASE WHEN uf.is_active THEN 1 ELSE -1 END), 0)::INTEGER AS favorite_growth_count
    FROM public.user_favorites uf
    WHERE uf.last_action_at >= NOW() - INTERVAL '90 days'
      AND uf.last_action_at <= NOW()
    GROUP BY uf.girl_id
),
performance_stats AS (
    SELECT
        g.id AS girl_id,
        COALESCE(os.online_seconds, 0) AS online_seconds,
        COALESCE(ords.order_count, 0) AS order_count,
        COALESCE(ords.order_duration_seconds, 0) AS order_duration_seconds,
        COALESCE(exts.extension_rate, 0) AS extension_rate,
        COALESCE(rpts.repeat_client_rate, 0) AS repeat_client_rate,
        COALESCE(favs.favorite_growth_count, 0) AS favorite_growth_count,
        COALESCE(acs.arrived_cancelled_count, 0) AS arrived_cancelled_count,
        CASE
            WHEN COALESCE(os.online_seconds, 0) > 0
                THEN ROUND((COALESCE(ords.order_duration_seconds, 0)::NUMERIC / os.online_seconds::NUMERIC) * 100, 2)
            ELSE 0
        END AS booking_rate_percent
    FROM public.girls g
    LEFT JOIN online_stats os ON g.id = os.girl_id
    LEFT JOIN order_stats ords ON g.id = ords.girl_id
    LEFT JOIN extension_stats exts ON g.id = exts.girl_id
    LEFT JOIN repeat_client_stats rpts ON g.id = rpts.girl_id
    LEFT JOIN favorite_stats favs ON g.id = favs.girl_id
    LEFT JOIN arrived_cancel_stats acs ON g.id = acs.girl_id
),
scored_stats AS (
    SELECT
        ps.*,
        CASE
            WHEN ps.booking_rate_percent >= 40 THEN 100
            WHEN ps.booking_rate_percent >= 30 THEN 80
            WHEN ps.booking_rate_percent >= 20 THEN 60
            WHEN ps.booking_rate_percent >= 10 THEN 40
            ELSE 20
        END AS booking_score,
        CASE
            WHEN ps.extension_rate >= 30 THEN 100
            WHEN ps.extension_rate >= 20 THEN 80
            WHEN ps.extension_rate >= 15 THEN 60
            WHEN ps.extension_rate >= 10 THEN 40
            WHEN ps.extension_rate >= 5 THEN 20
            ELSE 0
        END AS extension_score,
        CASE
            WHEN ps.repeat_client_rate >= 25 THEN 100
            WHEN ps.repeat_client_rate >= 20 THEN 80
            WHEN ps.repeat_client_rate >= 15 THEN 60
            WHEN ps.repeat_client_rate >= 10 THEN 40
            WHEN ps.repeat_client_rate >= 5 THEN 20
            ELSE 0
        END AS repeat_score,
        CASE
            WHEN (ps.order_count + ps.arrived_cancelled_count) = 0 THEN 100
            ELSE CASE
                WHEN ROUND((ps.arrived_cancelled_count::NUMERIC / (ps.order_count + ps.arrived_cancelled_count)::NUMERIC) * 100, 1) = 0 THEN 100
                WHEN ROUND((ps.arrived_cancelled_count::NUMERIC / (ps.order_count + ps.arrived_cancelled_count)::NUMERIC) * 100, 1) <= 5 THEN 80
                WHEN ROUND((ps.arrived_cancelled_count::NUMERIC / (ps.order_count + ps.arrived_cancelled_count)::NUMERIC) * 100, 1) <= 10 THEN 50
                WHEN ROUND((ps.arrived_cancelled_count::NUMERIC / (ps.order_count + ps.arrived_cancelled_count)::NUMERIC) * 100, 1) <= 20 THEN 20
                ELSE 0
            END
        END AS cancellation_score,
        CASE
            WHEN ps.favorite_growth_count > 10 THEN 100
            WHEN ps.favorite_growth_count >= 6 THEN 80
            WHEN ps.favorite_growth_count >= 1 THEN 60
            WHEN ps.favorite_growth_count >= -4 THEN 40
            ELSE 20
        END AS favorite_score
    FROM performance_stats ps
)
SELECT
    g.id AS girl_id,
    g.girl_number,
    g.name,
    g.avatar_url,
    g.city_id,
    ss.online_seconds,
    ss.order_count,
    ss.order_duration_seconds,
    ss.booking_rate_percent,
    ss.extension_rate,
    CASE
        WHEN ss.online_seconds < 36000 OR ss.order_count < 2 THEN 0
        ELSE
            ROUND(
                (ss.booking_score * 0.40) +
                (ss.extension_score * 0.30) +
                (ss.repeat_score * 0.15) +
                (ss.cancellation_score * 0.10) +
                (ss.favorite_score * 0.05),
                0
            )::SMALLINT
    END AS performance_index,
    CASE
        WHEN ss.online_seconds < 36000 OR ss.order_count < 2 THEN 'insufficient_data'
        WHEN ROUND(
            (ss.booking_score * 0.40) +
            (ss.extension_score * 0.30) +
            (ss.repeat_score * 0.15) +
            (ss.cancellation_score * 0.10) +
            (ss.favorite_score * 0.05),
            0
        ) >= 85 THEN 'excellent'
        WHEN ROUND(
            (ss.booking_score * 0.40) +
            (ss.extension_score * 0.30) +
            (ss.repeat_score * 0.15) +
            (ss.cancellation_score * 0.10) +
            (ss.favorite_score * 0.05),
            0
        ) >= 70 THEN 'good'
        WHEN ROUND(
            (ss.booking_score * 0.40) +
            (ss.extension_score * 0.30) +
            (ss.repeat_score * 0.15) +
            (ss.cancellation_score * 0.10) +
            (ss.favorite_score * 0.05),
            0
        ) >= 55 THEN 'average'
        WHEN ROUND(
            (ss.booking_score * 0.40) +
            (ss.extension_score * 0.30) +
            (ss.repeat_score * 0.15) +
            (ss.cancellation_score * 0.10) +
            (ss.favorite_score * 0.05),
            0
        ) >= 40 THEN 'poor'
        ELSE 'very_poor'
    END AS performance_rating
FROM public.girls g
LEFT JOIN scored_stats ss ON g.id = ss.girl_id
WHERE g.is_verified = true
  AND g.is_blocked = false
ORDER BY booking_rate_percent DESC NULLS LAST;

COMMENT ON VIEW public.v_girl_attendance_stats IS 'Therapist attendance stats for the last 30 days using normalized completed-order durations and online session durations.';

CREATE OR REPLACE FUNCTION public.get_girl_performance_snapshot(p_girl_id UUID)
RETURNS TABLE (
    booking_efficiency_rate NUMERIC,
    extension_rate NUMERIC,
    extra_time_total_minutes INTEGER,
    arrived_cancellation_rate NUMERIC,
    repeat_client_rate NUMERIC,
    favorite_growth_count INTEGER,
    performance_index SMALLINT,
    performance_level TEXT,
    window_days INTEGER,
    generated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window_start TIMESTAMPTZ := NOW() - INTERVAL '90 days';
    v_order_seconds BIGINT := 0;
    v_online_seconds BIGINT := 0;
    v_completed_orders_count INTEGER := 0;
    v_extended_completed_orders_count INTEGER := 0;
    v_extra_time_total_minutes INTEGER := 0;
    v_arrived_cancelled_count INTEGER := 0;
    v_recent_completed_orders_count INTEGER := 0;
    v_repeat_client_count INTEGER := 0;
    v_recent_distinct_clients_count INTEGER := 0;
    v_favorite_growth_count INTEGER := 0;
    v_booking_efficiency_rate NUMERIC := 0;
    v_extension_rate NUMERIC := 0;
    v_arrived_cancellation_rate NUMERIC := 0;
    v_repeat_client_rate NUMERIC := 0;
    v_score_efficiency NUMERIC := 0;
    v_score_extension NUMERIC := 0;
    v_score_repeat NUMERIC := 0;
    v_score_favorite NUMERIC := 0;
    v_score_cancellation NUMERIC := 100;
    v_performance_index NUMERIC := 0;
    v_performance_level TEXT := 'Needs Attention';
BEGIN
    IF p_girl_id IS NULL THEN
        RETURN;
    END IF;

    IF NOT (
        auth.role() = 'service_role'
        OR public.is_admin()
        OR EXISTS (
            SELECT 1
            FROM public.girls g
            WHERE g.id = p_girl_id
              AND g.user_id = auth.uid()
        )
    ) THEN
        RAISE EXCEPTION 'permission denied';
    END IF;

    SELECT COALESCE(SUM(vons.normalized_duration_seconds), 0)
    INTO v_order_seconds
    FROM public.v_order_normalized_sessions vons
    WHERE vons.girl_id = p_girl_id
      AND vons.completed_at >= v_window_start;

    SELECT COALESCE(SUM(gws.duration_seconds), 0)
    INTO v_online_seconds
    FROM public.girl_work_sessions gws
    WHERE gws.girl_id = p_girl_id
      AND gws.session_type = 'online'
      AND gws.ended_at >= v_window_start;

    SELECT
        COALESCE(COUNT(*), 0),
        COALESCE(COUNT(*) FILTER (WHERE ext.order_id IS NOT NULL), 0)
    INTO
        v_completed_orders_count,
        v_extended_completed_orders_count
    FROM public.orders o
    LEFT JOIN (
        SELECT DISTINCT ote.order_id
        FROM public.order_time_extensions ote
        WHERE ote.girl_id = p_girl_id
          AND ote.settlement_status != 'rejected'
    ) ext ON ext.order_id = o.id
    WHERE o.girl_id = p_girl_id
      AND o.status = 'completed'
      AND o.completed_at >= v_window_start;

    SELECT COALESCE(SUM(ote.duration_minutes), 0)::INTEGER
    INTO v_extra_time_total_minutes
    FROM public.order_time_extensions ote
    WHERE ote.girl_id = p_girl_id
      AND ote.settlement_status != 'rejected';

    SELECT COALESCE(COUNT(*), 0)
    INTO v_arrived_cancelled_count
    FROM public.order_cancellations oc
    INNER JOIN public.orders o ON o.id = oc.order_id
    WHERE o.girl_id = p_girl_id
      AND oc.cancelled_at >= v_window_start
      AND oc.previous_status IN ('arrived', 'in_service');

    SELECT COALESCE(COUNT(*), 0)
    INTO v_recent_completed_orders_count
    FROM public.orders o
    WHERE o.girl_id = p_girl_id
      AND o.status = 'completed'
      AND o.completed_at >= v_window_start;

    WITH recent_clients AS (
        SELECT DISTINCT o.user_id
        FROM public.orders o
        WHERE o.girl_id = p_girl_id
          AND o.status = 'completed'
          AND o.completed_at >= v_window_start
          AND o.user_id IS NOT NULL
    ),
    historical_completed AS (
        SELECT o.user_id, COUNT(*) AS completed_count
        FROM public.orders o
        WHERE o.girl_id = p_girl_id
          AND o.status = 'completed'
          AND o.user_id IS NOT NULL
        GROUP BY o.user_id
    )
    SELECT
        COALESCE(COUNT(rc.user_id), 0),
        COALESCE(COUNT(rc.user_id) FILTER (WHERE hc.completed_count >= 2), 0)
    INTO
        v_recent_distinct_clients_count,
        v_repeat_client_count
    FROM recent_clients rc
    LEFT JOIN historical_completed hc ON hc.user_id = rc.user_id;

    SELECT COALESCE(SUM(CASE WHEN uf.is_active THEN 1 ELSE -1 END), 0)::INTEGER
    INTO v_favorite_growth_count
    FROM public.user_favorites uf
    WHERE uf.girl_id = p_girl_id
      AND uf.last_action_at >= v_window_start;

    v_booking_efficiency_rate := CASE
        WHEN v_online_seconds > 0
            THEN ROUND((v_order_seconds::NUMERIC / v_online_seconds::NUMERIC) * 100, 1)
        ELSE 0
    END;

    v_extension_rate := CASE
        WHEN v_completed_orders_count > 0
            THEN ROUND((v_extended_completed_orders_count::NUMERIC / v_completed_orders_count::NUMERIC) * 100, 1)
        ELSE 0
    END;

    v_arrived_cancellation_rate := CASE
        WHEN (v_recent_completed_orders_count + v_arrived_cancelled_count) > 0
            THEN ROUND(
                (v_arrived_cancelled_count::NUMERIC / (v_recent_completed_orders_count + v_arrived_cancelled_count)::NUMERIC) * 100,
                1
            )
        ELSE 0
    END;

    v_repeat_client_rate := CASE
        WHEN v_recent_distinct_clients_count > 0
            THEN ROUND((v_repeat_client_count::NUMERIC / v_recent_distinct_clients_count::NUMERIC) * 100, 1)
        ELSE 0
    END;

    v_score_efficiency := CASE
        WHEN v_booking_efficiency_rate >= 40 THEN 100
        WHEN v_booking_efficiency_rate >= 30 THEN 80
        WHEN v_booking_efficiency_rate >= 20 THEN 60
        WHEN v_booking_efficiency_rate >= 10 THEN 40
        ELSE 20
    END;

    v_score_extension := CASE
        WHEN v_extension_rate >= 30 THEN 100
        WHEN v_extension_rate >= 20 THEN 80
        WHEN v_extension_rate >= 15 THEN 60
        WHEN v_extension_rate >= 10 THEN 40
        WHEN v_extension_rate >= 5 THEN 20
        ELSE 0
    END;

    v_score_repeat := CASE
        WHEN v_repeat_client_rate >= 25 THEN 100
        WHEN v_repeat_client_rate >= 20 THEN 80
        WHEN v_repeat_client_rate >= 15 THEN 60
        WHEN v_repeat_client_rate >= 10 THEN 40
        WHEN v_repeat_client_rate >= 5 THEN 20
        ELSE 0
    END;

    v_score_favorite := CASE
        WHEN v_favorite_growth_count > 10 THEN 100
        WHEN v_favorite_growth_count >= 6 THEN 80
        WHEN v_favorite_growth_count >= 1 THEN 60
        WHEN v_favorite_growth_count >= -4 THEN 40
        ELSE 20
    END;

    v_score_cancellation := CASE
        WHEN v_arrived_cancellation_rate = 0 THEN 100
        WHEN v_arrived_cancellation_rate <= 5 THEN 80
        WHEN v_arrived_cancellation_rate <= 10 THEN 50
        WHEN v_arrived_cancellation_rate <= 20 THEN 20
        ELSE 0
    END;

    v_performance_index :=
        (v_score_efficiency * 0.40) +
        (v_score_extension * 0.30) +
        (v_score_repeat * 0.15) +
        (v_score_cancellation * 0.10) +
        (v_score_favorite * 0.05);

    v_performance_index := ROUND(LEAST(GREATEST(v_performance_index, 0), 100), 0);

    IF v_performance_index >= 85 THEN
        v_performance_level := 'Excellent';
    ELSIF v_performance_index >= 70 THEN
        v_performance_level := 'Strong';
    ELSIF v_performance_index >= 55 THEN
        v_performance_level := 'Fair';
    ELSE
        v_performance_level := 'Needs Attention';
    END IF;

    RETURN QUERY
    SELECT
        v_booking_efficiency_rate,
        v_extension_rate,
        v_extra_time_total_minutes,
        v_arrived_cancellation_rate,
        v_repeat_client_rate,
        v_favorite_growth_count,
        v_performance_index::SMALLINT,
        v_performance_level,
        90,
        NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_me_performance_snapshot()
RETURNS TABLE (
    booking_efficiency_rate NUMERIC,
    extension_rate NUMERIC,
    extra_time_total_minutes INTEGER,
    arrived_cancellation_rate NUMERIC,
    repeat_client_rate NUMERIC,
    favorite_growth_count INTEGER,
    performance_index SMALLINT,
    performance_level TEXT,
    window_days INTEGER,
    generated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_girl_id UUID;
BEGIN
    SELECT g.id
    INTO v_girl_id
    FROM public.girls g
    WHERE g.user_id = auth.uid()
    LIMIT 1;

    IF v_girl_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT *
    FROM public.get_girl_performance_snapshot(v_girl_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_order_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_started_at TIMESTAMPTZ;
    v_ended_at TIMESTAMPTZ;
    v_duration_seconds BIGINT;
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed') THEN
        v_started_at := COALESCE(NEW.service_started_at, NEW.confirmed_at, NEW.created_at);
        v_ended_at := COALESCE(NEW.completed_at, NOW());

        IF v_started_at IS NULL OR v_ended_at <= v_started_at THEN
            RETURN NEW;
        END IF;

        v_duration_seconds := EXTRACT(EPOCH FROM (v_ended_at - v_started_at))::BIGINT;

        IF v_duration_seconds > 0 THEN
            INSERT INTO public.girl_work_sessions (
                girl_id,
                session_type,
                started_at,
                ended_at,
                duration_seconds,
                amount,
                order_id
            ) VALUES (
                NEW.girl_id,
                'order',
                v_started_at,
                v_ended_at,
                v_duration_seconds,
                NEW.total_amount,
                NEW.id
            )
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.get_girl_performance_snapshot(UUID) IS 'Returns a therapist performance snapshot for the last 90 days using normalized completed-order durations and valid add-time totals.';
COMMENT ON FUNCTION public.get_me_performance_snapshot() IS 'Returns the current therapist performance snapshot by reusing get_girl_performance_snapshot.';
COMMENT ON FUNCTION public.record_order_session() IS 'Records an order work session when an order is completed, using completed_at when available.';
