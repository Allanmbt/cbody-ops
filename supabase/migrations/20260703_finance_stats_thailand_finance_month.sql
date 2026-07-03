CREATE OR REPLACE FUNCTION get_finance_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH
  finance_month_params AS (
    SELECT
      DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok') - INTERVAL '6 hours') AS current_month,
      (
        DATE_TRUNC('month', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok') - INTERVAL '6 hours')
        - INTERVAL '11 months'
        + INTERVAL '6 hours'
      ) AT TIME ZONE 'Asia/Bangkok' AS start_at
  ),

  settlement_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE settlement_status = 'settled') AS total_verified,
      COUNT(*) FILTER (WHERE settlement_status = 'pending') AS total_pending,
      COUNT(*) FILTER (WHERE settlement_status = 'rejected') AS total_rejected
    FROM order_settlements
  ),

  revenue_stats AS (
    SELECT COALESCE(SUM(total_amount), 0) AS total_sales
    FROM orders
    WHERE status = 'completed'
  ),

  profit_stats AS (
    SELECT COALESCE(SUM(platform_should_get), 0) AS total_profit
    FROM order_settlements
    WHERE settlement_status = 'settled'
  ),

  expense_stats AS (
    SELECT COALESCE(SUM(actual_paid_amount), 0) AS total_expense
    FROM order_settlements
    WHERE settlement_status = 'settled' AND actual_paid_amount IS NOT NULL
  ),

  transaction_stats AS (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'settlement'), 0) AS total_settlement,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'withdrawal'), 0) AS total_withdrawal,
      COUNT(*) FILTER (WHERE transaction_type = 'settlement') AS settlement_count,
      COUNT(*) FILTER (WHERE transaction_type = 'withdrawal') AS withdrawal_count
    FROM settlement_transactions
    WHERE status = 'confirmed'
  ),

  account_stats AS (
    SELECT
      COALESCE(SUM(balance), 0) AS total_debt,
      COALESCE(SUM(deposit_amount), 0) AS total_deposit
    FROM girl_settlement_accounts
  ),

  monthly_settlement AS (
    SELECT
      TO_CHAR((confirmed_at AT TIME ZONE 'Asia/Bangkok') - INTERVAL '6 hours', 'YYYY-MM') AS month,
      COALESCE(SUM(amount), 0) AS amount
    FROM settlement_transactions
    CROSS JOIN finance_month_params fmp
    WHERE transaction_type = 'settlement'
      AND status = 'confirmed'
      AND confirmed_at >= fmp.start_at
    GROUP BY TO_CHAR((confirmed_at AT TIME ZONE 'Asia/Bangkok') - INTERVAL '6 hours', 'YYYY-MM')
  ),

  monthly_withdrawal AS (
    SELECT
      TO_CHAR((confirmed_at AT TIME ZONE 'Asia/Bangkok') - INTERVAL '6 hours', 'YYYY-MM') AS month,
      COALESCE(SUM(amount), 0) AS amount
    FROM settlement_transactions
    CROSS JOIN finance_month_params fmp
    WHERE transaction_type = 'withdrawal'
      AND status = 'confirmed'
      AND confirmed_at >= fmp.start_at
    GROUP BY TO_CHAR((confirmed_at AT TIME ZONE 'Asia/Bangkok') - INTERVAL '6 hours', 'YYYY-MM')
  ),

  monthly_revenue AS (
    SELECT
      TO_CHAR((completed_at AT TIME ZONE 'Asia/Bangkok') - INTERVAL '6 hours', 'YYYY-MM') AS month,
      COALESCE(SUM(total_amount), 0) AS amount
    FROM orders
    CROSS JOIN finance_month_params fmp
    WHERE status = 'completed'
      AND completed_at >= fmp.start_at
    GROUP BY TO_CHAR((completed_at AT TIME ZONE 'Asia/Bangkok') - INTERVAL '6 hours', 'YYYY-MM')
  ),

  monthly_profit AS (
    SELECT
      TO_CHAR((settled_at AT TIME ZONE 'Asia/Bangkok') - INTERVAL '6 hours', 'YYYY-MM') AS month,
      COALESCE(SUM(platform_should_get), 0) AS amount
    FROM order_settlements
    CROSS JOIN finance_month_params fmp
    WHERE settlement_status = 'settled'
      AND settled_at >= fmp.start_at
    GROUP BY TO_CHAR((settled_at AT TIME ZONE 'Asia/Bangkok') - INTERVAL '6 hours', 'YYYY-MM')
  ),

  monthly_expense AS (
    SELECT
      TO_CHAR((settled_at AT TIME ZONE 'Asia/Bangkok') - INTERVAL '6 hours', 'YYYY-MM') AS month,
      COALESCE(SUM(actual_paid_amount), 0) AS amount
    FROM order_settlements
    CROSS JOIN finance_month_params fmp
    WHERE settlement_status = 'settled'
      AND actual_paid_amount IS NOT NULL
      AND settled_at >= fmp.start_at
    GROUP BY TO_CHAR((settled_at AT TIME ZONE 'Asia/Bangkok') - INTERVAL '6 hours', 'YYYY-MM')
  ),

  month_series AS (
    SELECT TO_CHAR(month_date, 'YYYY-MM') AS month
    FROM finance_month_params fmp
    CROSS JOIN GENERATE_SERIES(
      fmp.current_month - INTERVAL '11 months',
      fmp.current_month,
      INTERVAL '1 month'
    ) AS month_date
  )

  SELECT JSON_BUILD_OBJECT(
    'settlements', JSON_BUILD_OBJECT(
      'total_verified', (SELECT total_verified FROM settlement_stats),
      'total_pending', (SELECT total_pending FROM settlement_stats),
      'total_rejected', (SELECT total_rejected FROM settlement_stats)
    ),
    'revenue', JSON_BUILD_OBJECT(
      'total_sales', (SELECT total_sales FROM revenue_stats),
      'monthly_chart', (
        SELECT JSON_AGG(JSON_BUILD_OBJECT('month', ms.month, 'amount', COALESCE(mr.amount, 0)) ORDER BY ms.month)
        FROM month_series ms
        LEFT JOIN monthly_revenue mr ON ms.month = mr.month
      )
    ),
    'profit', JSON_BUILD_OBJECT(
      'total_profit', (SELECT total_profit FROM profit_stats),
      'monthly_chart', (
        SELECT JSON_AGG(JSON_BUILD_OBJECT('month', ms.month, 'amount', COALESCE(mp.amount, 0)) ORDER BY ms.month)
        FROM month_series ms
        LEFT JOIN monthly_profit mp ON ms.month = mp.month
      )
    ),
    'expense', JSON_BUILD_OBJECT(
      'total_expense', (SELECT total_expense FROM expense_stats),
      'monthly_chart', (
        SELECT JSON_AGG(JSON_BUILD_OBJECT('month', ms.month, 'amount', COALESCE(me.amount, 0)) ORDER BY ms.month)
        FROM month_series ms
        LEFT JOIN monthly_expense me ON ms.month = me.month
      )
    ),
    'transactions', JSON_BUILD_OBJECT(
      'total_settlement', (SELECT total_settlement FROM transaction_stats),
      'total_withdrawal', (SELECT total_withdrawal FROM transaction_stats),
      'settlement_count', (SELECT settlement_count FROM transaction_stats),
      'withdrawal_count', (SELECT withdrawal_count FROM transaction_stats),
      'total_debt', (SELECT total_debt FROM account_stats),
      'total_deposit', (SELECT total_deposit FROM account_stats),
      'monthly_settlement_chart', (
        SELECT JSON_AGG(JSON_BUILD_OBJECT('month', ms.month, 'amount', COALESCE(mst.amount, 0)) ORDER BY ms.month)
        FROM month_series ms
        LEFT JOIN monthly_settlement mst ON ms.month = mst.month
      ),
      'monthly_withdrawal_chart', (
        SELECT JSON_AGG(JSON_BUILD_OBJECT('month', ms.month, 'amount', COALESCE(mwd.amount, 0)) ORDER BY ms.month)
        FROM month_series ms
        LEFT JOIN monthly_withdrawal mwd ON ms.month = mwd.month
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_finance_stats() IS '财务统计 RPC 函数 - 月度图表按泰国财务月（每月1日06:00到下月1日06:00）统计';
