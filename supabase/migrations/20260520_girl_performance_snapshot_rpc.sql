DROP FUNCTION IF EXISTS public.get_girl_performance_snapshot(uuid);
DROP FUNCTION IF EXISTS public.get_me_performance_snapshot();

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
    v_score_extra_time NUMERIC := 0;
    v_penalty_arrived_cancel NUMERIC := 0;
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

    SELECT
        COALESCE(SUM(CASE WHEN gws.session_type = 'order' THEN gws.duration_seconds ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN gws.session_type = 'online' THEN gws.duration_seconds ELSE 0 END), 0)
    INTO
        v_order_seconds,
        v_online_seconds
    FROM public.girl_work_sessions gws
    WHERE gws.girl_id = p_girl_id
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
    ) ext ON ext.order_id = o.id
    WHERE o.girl_id = p_girl_id
      AND o.status = 'completed'
      AND o.completed_at >= v_window_start;

    SELECT COALESCE(SUM(ote.duration_minutes), 0)::INTEGER
    INTO v_extra_time_total_minutes
    FROM public.order_time_extensions ote
    WHERE ote.girl_id = p_girl_id;

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

    v_score_efficiency := LEAST(GREATEST(v_booking_efficiency_rate, 0), 100);
    v_score_extension := LEAST(GREATEST(v_extension_rate, 0), 100);
    v_score_repeat := LEAST(GREATEST(v_repeat_client_rate, 0), 100);
    v_score_favorite := LEAST(GREATEST(((v_favorite_growth_count + 10)::NUMERIC / 20::NUMERIC) * 100, 0), 100);
    v_score_extra_time := LEAST(GREATEST((v_extra_time_total_minutes::NUMERIC / 1200::NUMERIC) * 100, 0), 100);
    v_penalty_arrived_cancel := LEAST(GREATEST(v_arrived_cancellation_rate, 0), 100);

    v_performance_index :=
        (v_score_efficiency * 0.38) +
        (v_score_extension * 0.32) +
        (v_score_repeat * 0.13) +
        (v_score_favorite * 0.08) +
        (v_score_extra_time * 0.05) -
        (v_penalty_arrived_cancel * 0.04);

    v_performance_index := ROUND(LEAST(GREATEST(v_performance_index, 0), 100), 0);

    IF v_performance_index >= 90 THEN
        v_performance_level := 'Excellent';
    ELSIF v_performance_index >= 75 THEN
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

GRANT EXECUTE ON FUNCTION public.get_girl_performance_snapshot(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_me_performance_snapshot() TO authenticated;

COMMENT ON FUNCTION public.get_girl_performance_snapshot(UUID) IS 'Returns a therapist performance snapshot for the last 90 days plus lifetime add-time totals.';
COMMENT ON FUNCTION public.get_me_performance_snapshot() IS 'Returns the current therapist performance snapshot by reusing get_girl_performance_snapshot.';
