-- 会话列表始终展示该会话最近关联的订单。
CREATE OR REPLACE VIEW public.v_chat_monitoring AS
SELECT
  ct.id,
  ct.thread_type,
  ct.customer_id,
  ct.girl_id,
  ct.support_id,
  ct.is_locked,
  ct.last_message_at,
  ct.last_message_text,
  ct.created_at,
  ct.updated_at,

  customer.id AS customer_user_id,
  customer.username AS customer_username,
  customer.display_name AS customer_display_name,
  customer.avatar_url AS customer_avatar_url,
  customer.level AS customer_level,
  customer.phone_country_code AS customer_phone_country_code,
  customer.phone_number AS customer_phone_number,
  customer.country_code AS customer_country_code,
  customer.language_code AS customer_language_code,
  customer.credit_score AS customer_credit_score,

  girl.id AS girl_id_full,
  girl.girl_number,
  girl.name AS girl_name,
  girl.username AS girl_username,
  girl.avatar_url AS girl_avatar_url,
  girl.sort_order AS girl_sort_order,

  support.id AS support_user_id,
  support.username AS support_username,
  support.display_name AS support_display_name,
  support.avatar_url AS support_avatar_url,

  (
    SELECT json_build_object(
      'order_number', o.order_number,
      'id', o.id
    )
    FROM public.chat_messages cm
    INNER JOIN public.orders o ON o.id = cm.order_id
    WHERE cm.thread_id = ct.id
      AND cm.order_id IS NOT NULL
    ORDER BY o.created_at DESC, cm.created_at DESC, o.id DESC
    LIMIT 1
  ) AS related_order

FROM public.chat_threads ct
LEFT JOIN public.user_profiles customer ON customer.id = ct.customer_id
LEFT JOIN public.girls girl ON girl.id = ct.girl_id
LEFT JOIN public.user_profiles support ON support.id = ct.support_id;

COMMENT ON VIEW public.v_chat_monitoring IS
  '会话监控视图，预关联用户、技师、客服信息和最近关联订单';
