-- ============================================================
-- 重构 settlement_transactions 表
-- 目的：只记录真实资金流动（技师结账/提现申请）
-- 移除订单关联字段，简化为纯粹的资金流水表
-- ============================================================

-- 1. 备份现有数据（可选，建议在生产环境执行前先备份）
CREATE TABLE IF NOT EXISTS settlement_transactions_backup AS 
SELECT * FROM settlement_transactions;

-- 2. 删除旧表（如果需要保留历史数据，可以重命名而不是删除）
DROP TABLE IF EXISTS settlement_transactions CASCADE;

-- 3. 创建新的 settlement_transactions 表
CREATE TABLE settlement_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    girl_id UUID NOT NULL,
    transaction_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT,
    payment_proof_url TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    operator_id UUID,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 外键约束
    CONSTRAINT fk_settlement_tx_girl 
        FOREIGN KEY (girl_id) 
        REFERENCES girls(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_settlement_tx_operator 
        FOREIGN KEY (operator_id) 
        REFERENCES auth.users(id) 
        ON DELETE SET NULL,
    
    -- CHECK 约束
    CONSTRAINT chk_transaction_type 
        CHECK (transaction_type IN ('settlement', 'withdrawal')),
    
    CONSTRAINT chk_direction 
        CHECK (direction IN ('to_platform', 'to_girl')),
    
    CONSTRAINT chk_type_direction_binding 
        CHECK (
            (transaction_type = 'settlement' AND direction = 'to_platform') OR
            (transaction_type = 'withdrawal' AND direction = 'to_girl')
        ),
    
    CONSTRAINT chk_amount_positive 
        CHECK (amount > 0),
    
    CONSTRAINT chk_status 
        CHECK (status IN ('pending', 'confirmed', 'cancelled'))
);

-- 4. 创建索引
CREATE INDEX idx_settlement_tx_girl_id 
    ON settlement_transactions(girl_id, created_at DESC);

CREATE INDEX idx_settlement_tx_type 
    ON settlement_transactions(transaction_type);

CREATE INDEX idx_settlement_tx_status_pending 
    ON settlement_transactions(status) 
    WHERE status = 'pending';

-- 5. 添加表注释
COMMENT ON TABLE settlement_transactions IS '结账/提现申请表 - 记录技师与平台之间的真实资金流动';
COMMENT ON COLUMN settlement_transactions.id IS '主键';
COMMENT ON COLUMN settlement_transactions.girl_id IS '技师ID';
COMMENT ON COLUMN settlement_transactions.transaction_type IS '交易类型：settlement（技师结账给平台）/ withdrawal（技师提现）';
COMMENT ON COLUMN settlement_transactions.direction IS '资金流向：to_platform（技师给平台）/ to_girl（平台给技师）';
COMMENT ON COLUMN settlement_transactions.amount IS '本次结账/提现金额（正数）';
COMMENT ON COLUMN settlement_transactions.payment_method IS '支付方式：cash/wechat/alipay/bank 等';
COMMENT ON COLUMN settlement_transactions.payment_proof_url IS '支付凭证截图 URL';
COMMENT ON COLUMN settlement_transactions.notes IS '备注说明';
COMMENT ON COLUMN settlement_transactions.status IS '审核状态：pending（待审核）/confirmed（已确认）/cancelled（已取消）';
COMMENT ON COLUMN settlement_transactions.operator_id IS '审核人/操作人ID（管理员）';
COMMENT ON COLUMN settlement_transactions.confirmed_at IS '审核通过时间';
COMMENT ON COLUMN settlement_transactions.created_at IS '创建时间';

-- 6. 创建触发器：status 更新为 confirmed 时自动调整技师账户余额
CREATE OR REPLACE FUNCTION handle_settlement_transaction_confirmed()
RETURNS TRIGGER AS $$
BEGIN
    -- 只在 status 从 pending 变为 confirmed 时触发
    IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
        -- 根据交易类型调整余额
        IF NEW.transaction_type = 'settlement' AND NEW.direction = 'to_platform' THEN
            -- 技师结账给平台（THB）：balance 减少（欠款减少）
            UPDATE girl_settlement_accounts
            SET 
                balance = GREATEST(balance - NEW.amount, 0),  -- 确保不会变成负数
                updated_at = NOW()
            WHERE girl_id = NEW.girl_id;
            
        ELSIF NEW.transaction_type = 'withdrawal' AND NEW.direction = 'to_girl' THEN
            -- 平台提现给技师（RMB）：platform_collected_rmb_balance 减少
            UPDATE girl_settlement_accounts
            SET 
                platform_collected_rmb_balance = GREATEST(platform_collected_rmb_balance - NEW.amount, 0),  -- 确保不会变成负数
                updated_at = NOW()
            WHERE girl_id = NEW.girl_id;
        END IF;
        
        -- 设置确认时间
        NEW.confirmed_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS trg_settlement_transaction_confirmed ON settlement_transactions;

-- 创建新触发器
CREATE TRIGGER trg_settlement_transaction_confirmed
    BEFORE UPDATE ON settlement_transactions
    FOR EACH ROW
    EXECUTE FUNCTION handle_settlement_transaction_confirmed();

-- 8. 启用 RLS
ALTER TABLE settlement_transactions ENABLE ROW LEVEL SECURITY;

-- 9. 创建新的 RLS 策略
-- 技师查看自己的结账/提现记录
CREATE POLICY "settlement_transactions.self.select"
    ON settlement_transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.girls g
            WHERE g.id = settlement_transactions.girl_id 
              AND g.user_id = auth.uid()
        )
    );

-- 技师可以创建结账/提现申请（默认待审核）
CREATE POLICY "settlement_transactions.self.insert"
    ON settlement_transactions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.girls g
            WHERE g.id = settlement_transactions.girl_id 
              AND g.user_id = auth.uid()
        )
        AND transaction_type IN ('settlement', 'withdrawal')
        AND status = 'pending'
    );

-- 管理员查看所有记录
CREATE POLICY "settlement_transactions.admin.select"
    ON settlement_transactions
    FOR SELECT
    USING (public.is_admin());

-- 管理员可以管理所有记录（审核、取消等）
CREATE POLICY "settlement_transactions.admin.all"
    ON settlement_transactions
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 10. 授权
GRANT SELECT, INSERT ON settlement_transactions TO authenticated;

-- 禁止删除记录
-- 不创建 DELETE 策略，确保所有记录不可物理删除
