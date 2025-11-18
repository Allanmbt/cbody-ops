-- =============================================
-- 订单状态触发器：维护技师并发订单计数和预计空闲时间（V3 - 串行重算版）
-- =============================================
-- 功能：
-- 1. 维护 girls_status.active_orders_count（并发订单计数）
-- 2. 维护 girls_status.next_available_time（预计空闲时间）
-- 3. 自动更新 girls_status.status（available/busy），但不覆盖 offline 状态
-- 4. 维护 orders.scheduled_start_at 和 queue_position（排队信息）
--
-- 核心改进：
-- - 从累加逻辑改为完整重算逻辑
-- - 采用串行折叠计算排队链（非并行MAX）
-- - 每次订单状态变化时重新计算整个队列
-- - 手动下线状态优先，不被触发器覆盖
--
-- Bug 修复（2025-10-27）：
-- - 配合 update_order_status_v2.sql 的修复
-- - 当订单确认时（pending → confirmed），update_order_status 会设置 estimated_arrival_at = NOW() + eta_minutes
-- - 本触发器会在 estimated_arrival_at 更新时触发，使用实时确认时间重新计算排队链
-- - 触发器优先使用 estimated_arrival_at（实时时间），而不是 created_at（历史时间）
-- - 这确保了 next_available_time 基于技师实际确认订单的时间，而不是订单创建时间
--
-- Bug 修复（2025-11-07）：
-- - 修复排队订单ETA被吞掉的问题
-- - 之前使用 GREATEST(前一单结束, 候选开始) 导致排队订单的ETA被忽略
-- - 现在排队订单（queue_pos > 1）直接累加：开始时间 = 前一单结束 + 自己的ETA + 10分钟缓冲
-- - 确保每个排队订单的ETA都正确累加到 next_available_time
-- - 第一单开始服务时，仅调整第一单基准时间，不影响后续订单的间隔时长
-- - ETA基于Google路线API的最短时间，额外增加10分钟缓冲确保准时到达
-- - 当订单实际开始服务（service_started_at存在）时，使用实际时间，不需要ETA缓冲
-- =============================================

-- Step 1: 为 orders 表添加排队相关字段
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ NULL;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS queue_position INTEGER NULL;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_orders_girl_status_scheduled 
ON public.orders (girl_id, status, scheduled_start_at);

-- 添加字段注释
COMMENT ON COLUMN public.orders.scheduled_start_at IS '系统计算的预计开始服务时间';
COMMENT ON COLUMN public.orders.queue_position IS '技师队列中的排序序号（从1开始）';

-- Step 2: 确保 girls_status 表有必要字段
ALTER TABLE public.girls_status 
ADD COLUMN IF NOT EXISTS active_orders_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.girls_status.active_orders_count IS '当前活跃订单数量（confirmed/en_route/arrived/in_service）';

-- Step 3: 创建触发器函数（串行重算逻辑）
CREATE OR REPLACE FUNCTION public.maintain_girl_order_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_is_active BOOLEAN;
    v_new_is_active BOOLEAN;
    v_status_changed BOOLEAN;
    v_girl_id UUID;
    v_active_count INTEGER;
    v_next_available TIMESTAMPTZ;
    v_current_status TEXT;
BEGIN
    -- 确定操作类型和受影响的技师
    IF TG_OP = 'INSERT' THEN
        v_girl_id := NEW.girl_id;
        v_old_is_active := FALSE;
        v_new_is_active := NEW.status IN ('confirmed', 'en_route', 'arrived', 'in_service');
        v_status_changed := TRUE;
    ELSIF TG_OP = 'UPDATE' THEN
        v_girl_id := NEW.girl_id;
        v_old_is_active := OLD.status IN ('confirmed', 'en_route', 'arrived', 'in_service');
        v_new_is_active := NEW.status IN ('confirmed', 'en_route', 'arrived', 'in_service');
        
        -- 检查是否有状态变化或关键字段变化
        v_status_changed := (v_old_is_active != v_new_is_active) 
                         OR (OLD.service_started_at IS NULL AND NEW.service_started_at IS NOT NULL)
                         OR (OLD.estimated_arrival_at IS DISTINCT FROM NEW.estimated_arrival_at)
                         OR (OLD.eta_minutes IS DISTINCT FROM NEW.eta_minutes);
    ELSE
        RETURN NEW;
    END IF;

    -- 如果没有需要更新的变化，直接返回
    IF NOT v_status_changed THEN
        RETURN NEW;
    END IF;

    -- 获取技师当前状态（用于判断是否手动下线）
    SELECT status INTO v_current_status
    FROM public.girls_status
    WHERE girl_id = v_girl_id;

    -- 计算活跃订单数量
    SELECT COUNT(*)
    INTO v_active_count
    FROM public.orders
    WHERE girl_id = v_girl_id
      AND status IN ('confirmed', 'en_route', 'arrived', 'in_service');

    -- 串行计算排队链：使用递归CTE计算每个订单的预计开始时间和排队位置
    WITH RECURSIVE ordered_orders AS (
        -- Step 1: 获取所有活跃订单，并计算每个订单的候选开始时间
        SELECT 
            id,
            service_started_at,
            -- 候选开始时间：实际开始时间 > 预计到达时间 > 创建时间+ETA+缓冲
            COALESCE(
                service_started_at,
                estimated_arrival_at,
                created_at + ((COALESCE(eta_minutes, 30) + 10) || ' minutes')::INTERVAL  -- ETA + 10分钟缓冲
            ) AS candidate_start,
            service_duration,
            eta_minutes,  -- 保留eta_minutes用于排队订单累加
            created_at,
            ROW_NUMBER() OVER (ORDER BY 
                COALESCE(
                    service_started_at,
                    estimated_arrival_at,
                    created_at + ((COALESCE(eta_minutes, 30) + 10) || ' minutes')::INTERVAL
                ),
                created_at
            ) AS queue_pos
        FROM public.orders
        WHERE girl_id = v_girl_id
          AND status IN ('confirmed', 'en_route', 'arrived', 'in_service')
    ),
    queue_chain AS (
        -- Step 2: 递归计算串行排队链
        -- 基础情况：第一个订单
        SELECT 
            id,
            candidate_start AS scheduled_start,
            candidate_start + (service_duration || ' minutes')::INTERVAL AS scheduled_end,
            queue_pos,
            service_duration
        FROM ordered_orders
        WHERE queue_pos = 1
        
        UNION ALL
        
        -- 递归情况：排队订单累加ETA+缓冲（修复：不使用MAX，直接累加）
        SELECT 
            oo.id,
            -- 排队订单开始时间 = 前一单结束时间 + 自己的ETA + 10分钟缓冲
            qc.scheduled_end + ((COALESCE(oo.eta_minutes, 0) + 10) || ' minutes')::INTERVAL AS scheduled_start,
            -- 排队订单结束时间 = 开始时间 + 服务时长
            qc.scheduled_end + ((COALESCE(oo.eta_minutes, 0) + 10) || ' minutes')::INTERVAL + (oo.service_duration || ' minutes')::INTERVAL AS scheduled_end,
            oo.queue_pos,
            oo.service_duration
        FROM ordered_orders oo
        INNER JOIN queue_chain qc ON oo.queue_pos = qc.queue_pos + 1
    )
    -- Step 3: 更新每个订单的排队信息
    UPDATE public.orders o
    SET 
        scheduled_start_at = qc.scheduled_start,
        queue_position = qc.queue_pos::INTEGER,
        updated_at = NOW()
    FROM queue_chain qc
    WHERE o.id = qc.id;

    -- 计算技师的 next_available_time（最后一个订单的结束时间）
    SELECT MAX(scheduled_start_at + (service_duration || ' minutes')::INTERVAL)
    INTO v_next_available
    FROM public.orders
    WHERE girl_id = v_girl_id
      AND status IN ('confirmed', 'en_route', 'arrived', 'in_service')
      AND scheduled_start_at IS NOT NULL;

    -- 更新 girls_status
    -- 重要：手动 offline 状态优先，不被自动更新覆盖
    INSERT INTO public.girls_status (
        girl_id,
        status,
        active_orders_count,
        next_available_time,
        updated_at
    )
    VALUES (
        v_girl_id,
        CASE 
            WHEN v_active_count > 0 THEN 'busy'
            ELSE 'available'
        END,
        v_active_count,
        v_next_available,
        NOW()
    )
    ON CONFLICT (girl_id) DO UPDATE
    SET
        active_orders_count = EXCLUDED.active_orders_count,
        next_available_time = EXCLUDED.next_available_time,
        -- 状态更新规则：offline 优先，不被覆盖
        status = CASE
            WHEN girls_status.status = 'offline' THEN 'offline'  -- 手动下线优先
            WHEN EXCLUDED.active_orders_count > 0 THEN 'busy'    -- 有活跃订单 → busy
            ELSE 'available'                                      -- 无活跃订单 → available
        END,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- Step 4: 创建触发器
DROP TRIGGER IF EXISTS trg_orders_maintain_girl_stats ON public.orders;

CREATE TRIGGER trg_orders_maintain_girl_stats
    AFTER INSERT OR UPDATE OF status, service_started_at, eta_minutes, estimated_arrival_at
    ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.maintain_girl_order_stats();

-- 添加注释
COMMENT ON FUNCTION public.maintain_girl_order_stats IS '维护技师订单统计（V3 串行重算版）- 每次订单状态变化时重新计算完整排队链';
COMMENT ON TRIGGER trg_orders_maintain_girl_stats ON public.orders IS '订单状态变化时自动更新技师统计信息（串行排队逻辑）';

-- Step 5: 回填现有数据（一次性运维脚本）
DO $$
DECLARE
    v_girl RECORD;
    v_active_count INTEGER;
    v_next_available TIMESTAMPTZ;
BEGIN
    -- 遍历所有有订单的技师
    FOR v_girl IN
        SELECT DISTINCT girl_id
        FROM public.orders
        WHERE girl_id IS NOT NULL
    LOOP
        -- 计算活跃订单数
        SELECT COUNT(*)
        INTO v_active_count
        FROM public.orders
        WHERE girl_id = v_girl.girl_id
          AND status IN ('confirmed', 'en_route', 'arrived', 'in_service');

        -- 使用与触发器相同的串行排队逻辑
        WITH RECURSIVE ordered_orders AS (
            SELECT 
                id,
                service_started_at,
                COALESCE(
                    service_started_at,
                    estimated_arrival_at,
                    created_at + ((COALESCE(eta_minutes, 30) + 10) || ' minutes')::INTERVAL  -- ETA + 10分钟缓冲
                ) AS candidate_start,
                service_duration,
                eta_minutes,  -- 保留eta_minutes用于排队订单累加
                created_at,
                ROW_NUMBER() OVER (ORDER BY 
                    COALESCE(
                        service_started_at,
                        estimated_arrival_at,
                        created_at + ((COALESCE(eta_minutes, 30) + 10) || ' minutes')::INTERVAL
                    ),
                    created_at
                ) AS queue_pos
            FROM public.orders
            WHERE girl_id = v_girl.girl_id
              AND status IN ('confirmed', 'en_route', 'arrived', 'in_service')
        ),
        queue_chain AS (
            SELECT 
                id,
                candidate_start AS scheduled_start,
                candidate_start + (service_duration || ' minutes')::INTERVAL AS scheduled_end,
                queue_pos,
                service_duration
            FROM ordered_orders
            WHERE queue_pos = 1
            
            UNION ALL
            
            -- 排队订单累加ETA+缓冲（修复：不使用MAX，直接累加）
            SELECT 
                oo.id,
                qc.scheduled_end + ((COALESCE(oo.eta_minutes, 0) + 10) || ' minutes')::INTERVAL AS scheduled_start,
                qc.scheduled_end + ((COALESCE(oo.eta_minutes, 0) + 10) || ' minutes')::INTERVAL + (oo.service_duration || ' minutes')::INTERVAL AS scheduled_end,
                oo.queue_pos,
                oo.service_duration
            FROM ordered_orders oo
            INNER JOIN queue_chain qc ON oo.queue_pos = qc.queue_pos + 1
        )
        UPDATE public.orders o
        SET 
            scheduled_start_at = qc.scheduled_start,
            queue_position = qc.queue_pos::INTEGER
        FROM queue_chain qc
        WHERE o.id = qc.id;

        -- 计算 next_available_time
        SELECT MAX(scheduled_start_at + (service_duration || ' minutes')::INTERVAL)
        INTO v_next_available
        FROM public.orders
        WHERE girl_id = v_girl.girl_id
          AND status IN ('confirmed', 'en_route', 'arrived', 'in_service')
          AND scheduled_start_at IS NOT NULL;

        -- 更新或创建 girls_status 记录
        INSERT INTO public.girls_status (
            girl_id,
            status,
            active_orders_count,
            next_available_time
        )
        VALUES (
            v_girl.girl_id,
            CASE WHEN v_active_count > 0 THEN 'busy' ELSE 'available' END,
            v_active_count,
            v_next_available
        )
        ON CONFLICT (girl_id) DO UPDATE
        SET
            active_orders_count = EXCLUDED.active_orders_count,
            next_available_time = EXCLUDED.next_available_time,
            status = CASE
                WHEN girls_status.status = 'offline' THEN 'offline'
                WHEN EXCLUDED.active_orders_count > 0 THEN 'busy'
                ELSE 'available'
            END,
            updated_at = NOW();

        RAISE NOTICE 'Updated girl_id: %, active_orders: %, next_available: %',
            v_girl.girl_id, v_active_count, v_next_available;
    END LOOP;

    RAISE NOTICE 'Backfill completed successfully!';
END;
$$;

-- Step 6: 验证数据完整性（可选的定期检查脚本）
CREATE OR REPLACE FUNCTION public.verify_girl_order_stats()
RETURNS TABLE(
    girl_id UUID,
    cached_count INTEGER,
    actual_count INTEGER,
    cached_next_available TIMESTAMPTZ,
    actual_next_available TIMESTAMPTZ,
    is_consistent BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH actual_stats AS (
        SELECT
            o.girl_id,
            COUNT(*) FILTER (WHERE o.status IN ('confirmed', 'en_route', 'arrived', 'in_service')) AS active_count,
            MAX(o.scheduled_start_at + (o.service_duration || ' minutes')::INTERVAL) 
                FILTER (WHERE o.status IN ('confirmed', 'en_route', 'arrived', 'in_service')) AS next_avail
        FROM public.orders o
        WHERE o.girl_id IS NOT NULL
        GROUP BY o.girl_id
    )
    SELECT
        gs.girl_id,
        gs.active_orders_count,
        COALESCE(ast.active_count::INTEGER, 0),
        gs.next_available_time,
        ast.next_avail,
        (gs.active_orders_count = COALESCE(ast.active_count::INTEGER, 0) AND
         gs.next_available_time IS NOT DISTINCT FROM ast.next_avail) AS is_consistent
    FROM public.girls_status gs
    LEFT JOIN actual_stats ast ON ast.girl_id = gs.girl_id
    WHERE gs.active_orders_count != COALESCE(ast.active_count::INTEGER, 0)
       OR (gs.next_available_time IS DISTINCT FROM ast.next_avail);
END;
$$;

COMMENT ON FUNCTION public.verify_girl_order_stats IS '验证技师订单统计数据的一致性（串行重算版）';

-- 使用示例：
-- SELECT * FROM public.verify_girl_order_stats();

-- Step 7: 清空无效订单的排队信息（非活跃订单）
UPDATE public.orders
SET 
    scheduled_start_at = NULL,
    queue_position = NULL
WHERE status NOT IN ('confirmed', 'en_route', 'arrived', 'in_service')
  AND (scheduled_start_at IS NOT NULL OR queue_position IS NOT NULL);
