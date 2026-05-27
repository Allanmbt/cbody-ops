-- Order completion trigger
-- Keep the legacy raw session algorithm for therapist-side order completion flow.
-- Performance KPIs no longer depend on this raw order duration.

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
        v_started_at := COALESCE(NEW.service_started_at, NEW.created_at);
        v_ended_at := NOW();

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

DROP TRIGGER IF EXISTS trigger_order_completed_session ON public.orders;

CREATE TRIGGER trigger_order_completed_session
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.record_order_session();
