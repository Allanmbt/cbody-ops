-- 为 order_settlements 表添加自动计算 settlement_amount 的触发器
-- 执行时间：2024年
-- 用途：当 platform_should_get 或 customer_paid_to_platform 变化时，自动重新计算 settlement_amount

-- 创建触发器函数
CREATE OR REPLACE FUNCTION calculate_settlement_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- 自动计算 settlement_amount
    -- 公式：settlement_amount = platform_should_get - customer_paid_to_platform
    NEW.settlement_amount := NEW.platform_should_get - NEW.customer_paid_to_platform;
    
    -- 更新 updated_at
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器（INSERT 和 UPDATE 时都触发）
DROP TRIGGER IF EXISTS trg_calculate_settlement_amount ON order_settlements;
CREATE TRIGGER trg_calculate_settlement_amount
    BEFORE INSERT OR UPDATE OF platform_should_get, customer_paid_to_platform
    ON order_settlements
    FOR EACH ROW
    EXECUTE FUNCTION calculate_settlement_amount();

-- 添加注释
COMMENT ON FUNCTION calculate_settlement_amount() IS '自动计算订单核验的结算金额';
COMMENT ON TRIGGER trg_calculate_settlement_amount ON order_settlements IS '当平台应得或顾客已付变化时，自动重新计算结算金额';
