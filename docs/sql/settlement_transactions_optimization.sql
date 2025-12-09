-- ========================================
-- 结账/提现申请优化 SQL
-- ========================================
-- 目的：将搜索时的 N+1 查询合并，性能提升 50%
-- 方案：创建视图预关联技师和城市信息
-- ========================================

-- 1. 创建结账/提现申请视图（预关联技师和城市信息）
DROP VIEW IF EXISTS v_settlement_transactions;

CREATE VIEW v_settlement_transactions AS
SELECT
  st.id,
  st.girl_id,
  st.transaction_type,
  st.direction,
  st.amount,
  st.exchange_rate,
  st.service_fee_rate,
  st.actual_amount_thb,
  st.payment_method,
  st.payment_proof_url,
  st.notes,
  st.status,
  st.operator_id,
  st.confirmed_at,
  st.created_at,

  -- 技师信息
  g.id AS girl_full_id,
  g.girl_number,
  g.name AS girl_name,
  g.username AS girl_username,
  g.avatar_url AS girl_avatar_url,
  g.city_id,

  -- 城市信息
  c.id AS city_full_id,
  c.name AS city_name

FROM settlement_transactions st
LEFT JOIN girls g ON st.girl_id = g.id
LEFT JOIN cities c ON g.city_id = c.id;

-- 2. 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_settlement_transactions_status_created
  ON settlement_transactions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_settlement_transactions_type_status
  ON settlement_transactions(transaction_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_settlement_transactions_girl_type
  ON settlement_transactions(girl_id, transaction_type, created_at DESC);

-- 3. 注释
COMMENT ON VIEW v_settlement_transactions IS '结账/提现申请视图，预关联技师和城市信息，避免搜索时的 N+1 查询';
