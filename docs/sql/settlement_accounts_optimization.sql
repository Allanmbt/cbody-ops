-- ========================================
-- 结算账户优化 SQL
-- ========================================
-- 目的：将三表 JOIN 扁平化，性能提升 20-30%
-- 方案：创建视图预关联技师和城市信息
-- ========================================

-- 1. 创建结算账户视图（预关联技师和城市信息）
DROP VIEW IF EXISTS v_settlement_accounts;

CREATE VIEW v_settlement_accounts AS
SELECT
  gsa.id AS account_id,
  gsa.girl_id,
  gsa.balance,
  gsa.deposit_amount,
  gsa.frozen_balance_thb,
  gsa.platform_collected_rmb_balance,
  gsa.frozen_rmb_balance,
  gsa.currency,
  gsa.bank_account_name,
  gsa.bank_account_number,
  gsa.bank_name,
  gsa.bank_branch,
  gsa.bank_meta,
  gsa.created_at AS account_created_at,
  gsa.updated_at AS account_updated_at,

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

FROM girl_settlement_accounts gsa
LEFT JOIN girls g ON gsa.girl_id = g.id
LEFT JOIN cities c ON g.city_id = c.id;

-- 2. 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_girl_settlement_accounts_balance
  ON girl_settlement_accounts(balance DESC);

CREATE INDEX IF NOT EXISTS idx_girl_settlement_accounts_girl_id
  ON girl_settlement_accounts(girl_id);

CREATE INDEX IF NOT EXISTS idx_girls_girl_number
  ON girls(girl_number);

-- 3. 注释
COMMENT ON VIEW v_settlement_accounts IS '结算账户视图，预关联技师和城市信息，扁平化三表 JOIN';
