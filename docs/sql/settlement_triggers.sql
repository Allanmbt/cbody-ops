-- =====================================================
-- 结算系统触发器
-- =====================================================

-- =====================================================
-- 触发器1：当插入新技师时自动创建状态和结算账户
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_girl()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. 创建技师状态记录（如果不存在）
  INSERT INTO public.girls_status (
    girl_id,
    status,
    current_lat,
    current_lng,
    standby_lat,
    standby_lng,
    last_session_seconds,
    total_online_seconds,
    updated_at
  )
  VALUES (
    NEW.id,
    'offline',
    NULL,
    NULL,
    NULL,
    NULL,
    0,
    0,
    NOW()
  )
  ON CONFLICT (girl_id) DO NOTHING;

  -- 2. 创建结算账户记录
  INSERT INTO public.girl_settlement_accounts (
    girl_id,
    deposit_amount,
    balance,
    min_withdrawal_amount,
    deposit_threshold,
    currency
  )
  VALUES (
    NEW.id,
    0,
    0,
    3000,
    3000,
    'THB'
  )
  ON CONFLICT (girl_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS trg_handle_new_girl ON public.girls;

CREATE TRIGGER trg_handle_new_girl
  AFTER INSERT ON public.girls
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_girl();

COMMENT ON FUNCTION public.handle_new_girl() IS '当插入新技师时自动创建状态和结算账户';

-- =====================================================
-- 触发器2：订单完成时自动创建结算记录并更新账户余额
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_order_settlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_commission_rate DECIMAL(5,4);
  v_extra_commission_rate DECIMAL(5,4);
  v_platform_should_get DECIMAL(10,2);
  v_customer_paid DECIMAL(10,2);
  v_settlement_amount DECIMAL(10,2);
  v_default_service_rate DECIMAL(5,4);
BEGIN
  -- 只在订单变为 completed 时执行
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    
    -- 1. 获取服务提成比例（优先使用 services 表的 commission_rate，否则使用全局配置）
    SELECT commission_rate INTO v_service_commission_rate
    FROM public.services
    WHERE id = NEW.service_id;
    
    -- 如果服务表中没有设置，使用全局默认值
    IF v_service_commission_rate IS NULL THEN
      SELECT (value_json->>'rate')::DECIMAL(5,4) INTO v_default_service_rate
      FROM public.app_configs
      WHERE namespace = 'settlement'
        AND config_key = 'default_service_commission_rate'
        AND is_active = true
      LIMIT 1;
      
      v_service_commission_rate := COALESCE(v_default_service_rate, 0.4);
    END IF;
    
    -- 2. 获取额外费用提成比例
    SELECT (value_json->>'rate')::DECIMAL(5,4) INTO v_extra_commission_rate
    FROM public.app_configs
    WHERE namespace = 'settlement'
      AND config_key = 'extra_fee_commission_rate'
      AND is_active = true
    LIMIT 1;
    
    v_extra_commission_rate := COALESCE(v_extra_commission_rate, 0.2);
    
    -- 3. 计算平台应得金额
    v_platform_should_get := (NEW.service_fee * v_service_commission_rate) + 
                              (NEW.extra_fee * v_extra_commission_rate);
    
    -- 4. 顾客已付给平台的金额（默认为0，需要管理员后续更新）
    v_customer_paid := 0;
    
    -- 5. 计算结算金额（正数=技师需付平台，负数=平台需付技师）
    v_settlement_amount := v_platform_should_get - v_customer_paid;
    
    -- 6. 插入订单结算记录
    INSERT INTO public.order_settlements (
      order_id,
      girl_id,
      service_fee,
      extra_fee,
      service_commission_rate,
      extra_commission_rate,
      platform_should_get,
      customer_paid_to_platform,
      settlement_amount,
      settlement_status,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.girl_id,
      NEW.service_fee,
      NEW.extra_fee,
      v_service_commission_rate,
      v_extra_commission_rate,
      v_platform_should_get,
      v_customer_paid,
      v_settlement_amount,
      'pending',
      NOW(),
      NOW()
    )
    ON CONFLICT (order_id) DO NOTHING;
    
    -- 7. 更新技师结算账户余额
    -- balance 正数表示平台欠技师，负数表示技师欠平台
    -- settlement_amount 正数表示技师需付平台，所以要减去
    UPDATE public.girl_settlement_accounts
    SET 
      balance = balance - v_settlement_amount,
      updated_at = NOW()
    WHERE girl_id = NEW.girl_id;
    
    -- 8. 记录交易到 settlement_transactions（用于审计）
    INSERT INTO public.settlement_transactions (
      girl_id,
      transaction_type,
      amount,
      direction,
      order_id,
      order_settlement_id,
      notes,
      created_at
    )
    SELECT
      NEW.girl_id,
      'payment',
      ABS(v_settlement_amount),
      CASE 
        WHEN v_settlement_amount > 0 THEN 'to_platform'
        ELSE 'to_girl'
      END,
      NEW.id,
      os.id,
      '订单完成自动结算: ' || NEW.order_number,
      NOW()
    FROM public.order_settlements os
    WHERE os.order_id = NEW.id;
    
    -- 9. 检查是否超过欠款阈值，如果超过则记录日志（可扩展为自动禁止上线）
    DECLARE
      v_balance DECIMAL(10,2);
      v_threshold DECIMAL(10,2);
    BEGIN
      SELECT balance, deposit_threshold INTO v_balance, v_threshold
      FROM public.girl_settlement_accounts
      WHERE girl_id = NEW.girl_id;
      
      IF v_balance <= -v_threshold THEN
        RAISE NOTICE '技师 % 欠款已达阈值: balance=%, threshold=%', NEW.girl_id, v_balance, v_threshold;
        -- 可扩展：自动将技师设为 offline 或添加标记
      END IF;
    END;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS trg_order_completed_settlement ON public.orders;

CREATE TRIGGER trg_order_completed_settlement
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION public.calculate_order_settlement();

COMMENT ON FUNCTION public.calculate_order_settlement() IS '订单完成时自动创建结算记录并更新账户余额';

-- =====================================================
-- 触发器3：更新 order_settlements 时同步更新账户余额
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_settlement_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_change DECIMAL(10,2);
BEGIN
  -- 仅在 customer_paid_to_platform 或 settlement_amount 变化时触发
  IF OLD.customer_paid_to_platform != NEW.customer_paid_to_platform OR 
     OLD.settlement_amount != NEW.settlement_amount THEN
    
    -- 计算余额变化量
    v_balance_change := (OLD.settlement_amount - NEW.settlement_amount);
    
    -- 更新账户余额
    UPDATE public.girl_settlement_accounts
    SET 
      balance = balance + v_balance_change,
      updated_at = NOW()
    WHERE girl_id = NEW.girl_id;
    
    -- 记录交易
    IF v_balance_change != 0 THEN
      INSERT INTO public.settlement_transactions (
        girl_id,
        transaction_type,
        amount,
        direction,
        order_id,
        order_settlement_id,
        notes,
        created_at
      )
      VALUES (
        NEW.girl_id,
        'adjustment',
        ABS(v_balance_change),
        CASE 
          WHEN v_balance_change > 0 THEN 'to_girl'
          ELSE 'to_platform'
        END,
        NEW.order_id,
        NEW.id,
        '订单结算调整: 顾客支付 ' || NEW.customer_paid_to_platform,
        NOW()
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS trg_sync_settlement_balance ON public.order_settlements;

CREATE TRIGGER trg_sync_settlement_balance
  AFTER UPDATE ON public.order_settlements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_settlement_balance();

COMMENT ON FUNCTION public.sync_settlement_balance() IS '更新订单结算记录时同步更新账户余额';

-- =====================================================
-- 初始化：为现有技师创建结算账户
-- =====================================================
INSERT INTO public.girl_settlement_accounts (
  girl_id,
  deposit_amount,
  balance,
  min_withdrawal_amount,
  deposit_threshold,
  currency
)
SELECT 
  id,
  0,
  0,
  3000,
  3000,
  'THB'
FROM public.girls
ON CONFLICT (girl_id) DO NOTHING;

