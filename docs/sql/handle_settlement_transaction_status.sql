
-- =====================================================
-- 创建/更新触发器 handle_settlement_transaction_status
-- 管理员确认/取消时处理冻结金额
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_settlement_transaction_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 只处理状态从 pending 变为 confirmed 或 cancelled 的情况
  IF OLD.status = 'pending' AND NEW.status IN ('confirmed', 'cancelled') THEN

    IF NEW.status = 'confirmed' THEN
      -- ========== 确认：从冻结中扣除 ==========

      IF NEW.transaction_type = 'settlement' THEN
        -- 结账确认：扣除冻结的THB欠款
        UPDATE public.girl_settlement_accounts
        SET
          frozen_balance_thb = GREATEST(frozen_balance_thb - NEW.amount, 0),
          updated_at = NOW()
        WHERE girl_id = NEW.girl_id;

        RAISE NOTICE '结账确认：技师 % 扣除冻结欠款 % THB', NEW.girl_id, NEW.amount;

      ELSIF NEW.transaction_type = 'withdrawal' THEN
        -- 提现确认：扣除冻结的RMB代收
        UPDATE public.girl_settlement_accounts
        SET
          frozen_rmb_balance = GREATEST(frozen_rmb_balance - NEW.amount, 0),
          updated_at = NOW()
        WHERE girl_id = NEW.girl_id;

        RAISE NOTICE '提现确认：技师 % 扣除冻结代收 % RMB', NEW.girl_id, NEW.amount;
      END IF;

    ELSIF NEW.status = 'cancelled' THEN
      -- ========== 取消：解冻，退回到可用余额 ==========

      IF NEW.transaction_type = 'settlement' THEN
        -- 结账取消：冻结退回到 balance
        UPDATE public.girl_settlement_accounts
        SET
          balance = balance + NEW.amount,
          frozen_balance_thb = GREATEST(frozen_balance_thb - NEW.amount, 0),
          updated_at = NOW()
        WHERE girl_id = NEW.girl_id;

        RAISE NOTICE '结账取消：技师 % 解冻欠款 % THB', NEW.girl_id, NEW.amount;

      ELSIF NEW.transaction_type = 'withdrawal' THEN
        -- 提现取消：冻结退回到 platform_collected_rmb_balance
        UPDATE public.girl_settlement_accounts
        SET
          platform_collected_rmb_balance = platform_collected_rmb_balance + NEW.amount,
          frozen_rmb_balance = GREATEST(frozen_rmb_balance - NEW.amount, 0),
          updated_at = NOW()
        WHERE girl_id = NEW.girl_id;

        RAISE NOTICE '提现取消：技师 % 解冻代收 % RMB', NEW.girl_id, NEW.amount;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- 删除旧触发器并创建新触发器
DROP TRIGGER IF EXISTS trg_settlement_transaction_status ON public.settlement_transactions;

CREATE TRIGGER trg_settlement_transaction_status
  AFTER UPDATE ON public.settlement_transactions
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status IN ('confirmed', 'cancelled'))
  EXECUTE FUNCTION public.handle_settlement_transaction_status();

COMMENT ON FUNCTION public.handle_settlement_transaction_status() IS '处理结账/提现申请确认或取消时的冻结金额';
