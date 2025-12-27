-- 技师考勤统计视图
-- 目标：一次性查询技师最近30天的考勤数据，减少数据库查询次数
-- 包含：在线时长、完成订单数、订单总时长、预订率、综合评级

-- 先删除旧视图（如果存在）
DROP VIEW IF EXISTS v_girl_attendance_stats;

-- 重新创建视图
CREATE VIEW v_girl_attendance_stats AS
WITH recent_sessions AS (
  -- 获取最近30天的会话记录
  SELECT
    girl_id,
    session_type,
    duration_seconds,
    amount
  FROM girl_work_sessions
  WHERE ended_at >= NOW() - INTERVAL '30 days'
    AND ended_at <= NOW()
),
online_stats AS (
  -- 统计在线时长（秒）
  SELECT
    girl_id,
    COALESCE(SUM(duration_seconds), 0) AS online_seconds
  FROM recent_sessions
  WHERE session_type = 'online'
  GROUP BY girl_id
),
order_stats AS (
  -- 统计订单数量和时长（秒）
  SELECT
    girl_id,
    COUNT(*) AS order_count,
    COALESCE(SUM(duration_seconds), 0) AS order_duration_seconds
  FROM recent_sessions
  WHERE session_type = 'order'
  GROUP BY girl_id
)
SELECT
  g.id AS girl_id,
  g.girl_number,
  g.name,
  g.avatar_url,
  g.city_id,
  COALESCE(o_stats.online_seconds, 0) AS online_seconds,
  COALESCE(ord_stats.order_count, 0) AS order_count,
  COALESCE(ord_stats.order_duration_seconds, 0) AS order_duration_seconds,
  -- 预订率计算：订单时长 / 在线时长（避免除以0，转为百分比）
  CASE
    WHEN COALESCE(o_stats.online_seconds, 0) > 0
    THEN ROUND((COALESCE(ord_stats.order_duration_seconds, 0)::NUMERIC / o_stats.online_seconds::NUMERIC) * 100, 2)
    ELSE 0
  END AS booking_rate_percent,
  -- 综合评级计算（优质/较好/一般/较差/很差）
  -- 算法：基于在线时长、订单数、订单时长、预订率的加权评分
  CASE
    -- 数据不足：在线时长 < 10小时 或 订单数 < 2
    WHEN COALESCE(o_stats.online_seconds, 0) < 36000 OR COALESCE(ord_stats.order_count, 0) < 2 THEN 'insufficient_data'
    ELSE
      CASE
        -- 优质：预订率 >= 40% AND 订单数 >= 10 AND 在线时长 >= 50小时
        WHEN (
          CASE
            WHEN COALESCE(o_stats.online_seconds, 0) > 0
            THEN (COALESCE(ord_stats.order_duration_seconds, 0)::NUMERIC / o_stats.online_seconds::NUMERIC) * 100
            ELSE 0
          END >= 40
          AND COALESCE(ord_stats.order_count, 0) >= 10
          AND COALESCE(o_stats.online_seconds, 0) >= 180000
        ) THEN 'excellent'
        -- 较好：预订率 >= 30% AND 订单数 >= 5 AND 在线时长 >= 30小时
        WHEN (
          CASE
            WHEN COALESCE(o_stats.online_seconds, 0) > 0
            THEN (COALESCE(ord_stats.order_duration_seconds, 0)::NUMERIC / o_stats.online_seconds::NUMERIC) * 100
            ELSE 0
          END >= 30
          AND COALESCE(ord_stats.order_count, 0) >= 5
          AND COALESCE(o_stats.online_seconds, 0) >= 108000
        ) THEN 'good'
        -- 一般：预订率 >= 20% AND 订单数 >= 3
        WHEN (
          CASE
            WHEN COALESCE(o_stats.online_seconds, 0) > 0
            THEN (COALESCE(ord_stats.order_duration_seconds, 0)::NUMERIC / o_stats.online_seconds::NUMERIC) * 100
            ELSE 0
          END >= 20
          AND COALESCE(ord_stats.order_count, 0) >= 3
        ) THEN 'average'
        -- 较差：预订率 >= 10% OR 订单数 >= 2
        WHEN (
          CASE
            WHEN COALESCE(o_stats.online_seconds, 0) > 0
            THEN (COALESCE(ord_stats.order_duration_seconds, 0)::NUMERIC / o_stats.online_seconds::NUMERIC) * 100
            ELSE 0
          END >= 10
          OR COALESCE(ord_stats.order_count, 0) >= 2
        ) THEN 'poor'
        -- 很差：其他情况
        ELSE 'very_poor'
      END
  END AS performance_rating
FROM girls g
LEFT JOIN online_stats o_stats ON g.id = o_stats.girl_id
LEFT JOIN order_stats ord_stats ON g.id = ord_stats.girl_id
WHERE g.is_verified = true
  AND g.is_blocked = false
ORDER BY booking_rate_percent DESC NULLS LAST;

-- 为视图添加注释
COMMENT ON VIEW v_girl_attendance_stats IS '技师考勤统计视图：最近30天的在线时长、订单数量、订单时长、预订率和综合评级';
