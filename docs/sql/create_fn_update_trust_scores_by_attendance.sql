-- 创建函数：根据考勤表现批量更新技师诚信分
-- 基于最近30天的在线时长和预订率

CREATE OR REPLACE FUNCTION update_trust_scores_by_attendance()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- 批量更新技师诚信分
  UPDATE girls g
  SET
    trust_score = LEAST(100, GREATEST(0,
      g.trust_score +
      CASE
        -- 在线>=150小时的奖励规则
        WHEN stats.online_seconds >= 540000 AND stats.booking_rate_percent >= 30 THEN 3
        WHEN stats.online_seconds >= 540000 AND stats.booking_rate_percent >= 20 THEN 2
        WHEN stats.online_seconds >= 540000 AND stats.booking_rate_percent >= 12 THEN 1

        -- 在线>=100小时且<150小时的奖励规则
        WHEN stats.online_seconds >= 360000 AND stats.online_seconds < 540000 AND stats.booking_rate_percent > 30 THEN 2
        WHEN stats.online_seconds >= 360000 AND stats.online_seconds < 540000 AND stats.booking_rate_percent > 20 THEN 1

        -- 在线>=50小时且<100小时的惩罚规则
        WHEN stats.online_seconds >= 180000 AND stats.online_seconds < 360000 THEN -2

        -- 在线<50小时的惩罚规则
        WHEN stats.online_seconds < 180000 THEN -3

        ELSE 0
      END
    )),
    updated_at = NOW()
  FROM v_girl_attendance_stats stats
  WHERE g.id = stats.girl_id
    AND g.is_verified = true
    AND g.is_blocked = false;

  -- 获取更新数量
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN updated_count;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION update_trust_scores_by_attendance() IS '根据技师考勤表现批量更新诚信分（基于最近30天数据）';
