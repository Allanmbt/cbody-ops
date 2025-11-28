-- =====================================================
-- 添加汇率信息到订单平台收款页面数据中
-- =====================================================
--
-- 功能：在 get_order_payment_page_data 函数中添加 CNY↔THB 汇率信息
-- 从 app_configs 读取 cny_to_thb_rate 配置，显示当前汇率
--
-- 执行方式：复制下面的 SQL 到 Supabase SQL Editor 执行
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_order_payment_page_data(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_girl_id UUID;
  v_user_id UUID;
  v_order_settlement_id UUID;
  v_settlement_status TEXT;
  v_order_status TEXT;
  v_order_number TEXT;
  v_completed_at TIMESTAMPTZ;
  v_payments JSONB;
  v_total_amount DECIMAL(10,2);
  v_payment_count INT;
  v_qr_configs JSONB;
  v_can_edit BOOLEAN;
  v_exchange_rate DECIMAL(10,2);
  v_exchange_rate_info JSONB;
BEGIN
  -- 获取订单和结算信息
  SELECT
    o.status,
    o.order_number,
    o.completed_at,
    o.girl_id,
    g.user_id,
    os.id,
    os.settlement_status
  INTO
    v_order_status,
    v_order_number,
    v_completed_at,
    v_girl_id,
    v_user_id,
    v_order_settlement_id,
    v_settlement_status
  FROM public.orders o
  JOIN public.girls g ON g.id = o.girl_id
  LEFT JOIN public.order_settlements os ON os.order_id = o.id
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '订单不存在');
  END IF;

  -- 验证权限
  IF v_user_id != auth.uid() AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', '无权操作');
  END IF;

  -- 判断是否可编辑
  v_can_edit := FALSE;
  IF v_settlement_status IS NULL OR v_settlement_status = 'pending' THEN
    IF v_order_status IN ('pending', 'confirmed', 'en_route', 'arrived', 'in_service') THEN
      v_can_edit := TRUE;
    ELSIF v_order_status = 'completed' AND v_completed_at IS NOT NULL THEN
      IF EXTRACT(EPOCH FROM (NOW() - v_completed_at)) < 1800 THEN
        v_can_edit := TRUE;
      END IF;
    END IF;
  END IF;

  -- 查询收款明细
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'amount_rmb', amount_rmb,
        'payment_content_type', payment_content_type,
        'payment_method', payment_method,
        'proof_url', proof_url,
        'notes', notes,
        'created_at', created_at,
        'updated_at', updated_at
      ) ORDER BY created_at ASC
    ), '[]'::jsonb),
    COALESCE(SUM(amount_rmb), 0),
    COUNT(*)
  INTO v_payments, v_total_amount, v_payment_count
  FROM public.order_platform_payments
  WHERE order_id = p_order_id
    OR (order_settlement_id = v_order_settlement_id AND v_order_settlement_id IS NOT NULL);

  -- 获取平台收款码配置
  SELECT value_json INTO v_qr_configs
  FROM public.app_configs
  WHERE namespace = 'settlement'
    AND config_key = 'platform_payment_configs'
    AND scope = 'global'
  LIMIT 1;

  -- ✅ 获取人民币到泰铢汇率
  SELECT (value_json->>'rate')::DECIMAL(10,2) INTO v_exchange_rate
  FROM public.app_configs
  WHERE namespace = 'settlement'
    AND config_key = 'cny_to_thb_rate'
    AND scope = 'global'
  LIMIT 1;

  -- 构建汇率信息对象
  -- 格式：{ "rate": 5.0, "display": "1:5", "example_rmb": "¥100 = ฿500", "example_thb": "฿100 = ¥20" }
  IF v_exchange_rate IS NOT NULL THEN
    v_exchange_rate_info := jsonb_build_object(
      'rate', v_exchange_rate,
      'display', '1:' || v_exchange_rate::TEXT,
      'example_rmb_to_thb', '¥100 = ฿' || (100 * v_exchange_rate)::INT::TEXT,
      'example_thb_to_rmb', '฿100 = ¥' || (100 / v_exchange_rate)::INT::TEXT
    );
  ELSE
    v_exchange_rate_info := NULL;
  END IF;

  -- 返回完整数据
  RETURN jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'order_number', v_order_number,
    'order_status', v_order_status,
    'order_settlement_id', v_order_settlement_id,
    'settlement_status', v_settlement_status,
    'can_edit', v_can_edit,
    'summary', jsonb_build_object(
      'total_amount', v_total_amount,
      'payment_count', v_payment_count
    ),
    'payments', v_payments,
    'qr_configs', COALESCE(v_qr_configs, '{}'::jsonb),
    'exchange_rate', v_exchange_rate_info  -- ✅ 新增汇率信息
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_payment_page_data(UUID) TO authenticated;
COMMENT ON FUNCTION public.get_order_payment_page_data(UUID) IS '订单平台收款页面数据（包含汇率信息）';

-- =====================================================
-- 执行完成后，前端可以读取 exchange_rate 字段显示汇率信息
-- =====================================================
