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

  -- 2. 创建结算账户记录（最低提现标准从配置读取）
  INSERT INTO public.girl_settlement_accounts (
    girl_id,
    deposit_amount,
    balance,
    currency
  )
  VALUES (
    NEW.id,
    0,
    0,
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
    -- 新逻辑：balance 为技师欠平台的金额（正数），settlement_amount 正数表示技师需付平台
    -- 所以要累加到 balance
    UPDATE public.girl_settlement_accounts
    SET 
      balance = balance + v_settlement_amount,
      updated_at = NOW()
    WHERE girl_id = NEW.girl_id;
    
    -- 8. 检查是否超过欠款阈值，如果超过则记录日志（可扩展为自动禁止上线）
    DECLARE
      v_balance DECIMAL(10,2);
      v_deposit_amount DECIMAL(10,2);
    BEGIN
      SELECT balance, deposit_amount INTO v_balance, v_deposit_amount
      FROM public.girl_settlement_accounts
      WHERE girl_id = NEW.girl_id;
      
      -- 使用 deposit_amount 作为欠款阈值
      -- balance 为正数，表示技师欠平台
      IF v_balance >= v_deposit_amount * 0.8 THEN
        RAISE NOTICE '技师 % 欠款预警: balance=%, deposit_amount=%, 已达80%%阈值', NEW.girl_id, v_balance, v_deposit_amount;
      END IF;
      
      IF v_balance > v_deposit_amount THEN
        RAISE NOTICE '技师 % 欠款超限: balance=%, deposit_amount=%, 应禁止上线', NEW.girl_id, v_balance, v_deposit_amount;
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
-- 触发器3：订单核验通过时同步更新账户余额
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_settlement_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 仅在 settlement_status 从 pending 变为 settled 时触发
  IF OLD.settlement_status = 'pending' AND NEW.settlement_status = 'settled' THEN
    
    -- 1. 订单抽成记账：将 platform_should_get 累加到 balance（THB 欠款）
    UPDATE public.girl_settlement_accounts
    SET 
      balance = balance + NEW.platform_should_get,
      updated_at = NOW()
    WHERE girl_id = NEW.girl_id;
    
    -- 2. 平台代收记账：若使用平台收款码代收且有金额，累加到 platform_collected_rmb_balance
    IF NEW.payment_method IN ('wechat', 'alipay') AND COALESCE(NEW.actual_paid_amount, 0) > 0 THEN
      UPDATE public.girl_settlement_accounts
      SET 
        platform_collected_rmb_balance = platform_collected_rmb_balance + NEW.actual_paid_amount,
        updated_at = NOW()
      WHERE girl_id = NEW.girl_id;
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
