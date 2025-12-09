-- ========================================
-- 财务结算单优化 SQL
-- ========================================
-- 目的：将 N+1 查询合并为单次查询，性能提升 3-5 倍
-- 方案：创建视图预关联订单、技师信息
-- ========================================

-- 1. 创建结算单监控视图（预关联订单和技师信息）
DROP VIEW IF EXISTS v_finance_settlements;

CREATE VIEW v_finance_settlements AS
SELECT
  os.id,
  os.order_id,
  os.girl_id,
  os.service_fee,
  os.extra_fee,
  os.service_commission_rate,
  os.extra_commission_rate,
  os.platform_should_get,
  os.customer_paid_to_platform,
  os.settlement_amount,
  os.actual_paid_amount,
  os.payment_content_type,
  os.payment_method,
  os.payment_notes,
  os.settlement_status,
  os.notes,
  os.created_at,
  os.settled_at,
  os.rejected_at,
  os.reject_reason,
  os.updated_at,

  -- 订单信息
  o.order_number,
  o.status AS order_status,
  o.completed_at AS order_completed_at,

  -- 技师信息
  g.girl_number,
  g.name AS girl_name,
  g.username AS girl_username,
  g.avatar_url AS girl_avatar_url

FROM order_settlements os
LEFT JOIN orders o ON os.order_id = o.id
LEFT JOIN girls g ON os.girl_id = g.id;

-- 2. 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_order_settlements_created_at
  ON order_settlements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_settlements_status_created
  ON order_settlements(settlement_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_settlements_girl_id
  ON order_settlements(girl_id);

-- 3. 注释
COMMENT ON VIEW v_finance_settlements IS '财务结算单视图，预关联订单和技师信息，避免 N+1 查询';
