# RPC 和触发器 列表管理

> 本文件仅作为索引导航，不展示代码。  
> 每个函数 / 触发器的说明详见对应 md 文件。
> 你可以选择 查看适合本项目的文档。
---

## 🧩 公用 RPC

### 聊天模块
- [chat_rpcs.md](./rpc/chat_rpcs.md)

### 登录与认证
<!-- - [auth_rpcs.md](./rpc/auth_rpcs.md) -->

---

## 📱 客户端专用 RPC

### 首页（发现页）获取技师列表
- [HOME-RPC-V3.md](./rpc/HOME-RPC-V3.md)

### 订单与下单流程
- [order_rpcs.md](./rpc/order_rpcs.md)

### 轻量级技师详情接口（用于详情页头部信息）
- [RPC-GIRL-DETAIL.md](./rpc/RPC-GIRL-DETAIL.md)

### 获取技师的可售服务列表
- [RPC-GIRL-SERVICES.md](./rpc/RPC-GIRL-SERVICES.md)

### 获取技师的实时状态
- [RPC-GIRL-STATUS.md](./rpc/RPC-GIRL-STATUS.md)

### 下单时 根据距离（米）和自由流时长（秒）计算旅行费和 ETA
- [calc_travel_fee_eta.md](./rpc/calc_travel_fee_eta.md)

### 下单时 使用 PostGIS ST_DWithin 查询 travel_od_dual 缓存
- [query_travel_od_cache.md](./rpc/query_travel_od_cache.md)

### 下单确认提交
- [place_order.md](./rpc/place_order.md)


---

## 👩 技师端 RPC

### 订单状态更新
- [update_order_status.md](./rpc/update_order_status.md)

### 价格变更系统 (延迟生效 + 冷却时间反作弊)
- [request_price_change.md](./rpc/request_price_change.md)

### 技师状态管理（自动上下班 + 定位）
- [girl_status_rpcs.md](./rpc/girl_status_rpcs.md)

### 技师个人中心仪表盘
- [me_rpcs.sql](./sql/me_rpcs.sql) - `get_me_dashboard()` 获取技师统计数据

### 服务设置
- [service_settings_rpc.sql](./sql/service_settings_rpc.sql) - `update_max_travel_distance()` 更新最大服务距离

### 聊天用户管理
- **`toggle_block_user(p_customer_id UUID)`** - 技师屏蔽/解除屏蔽客户
  - **参数**：
    - `p_customer_id` - 要屏蔽/解除屏蔽的客户ID
  - **返回**：JSONB
    ```json
    {
      "success": true,
      "is_blocked": true,
      "message": "User has been blocked"
    }
    ```
  - **权限**：仅技师端可调用（通过 `girls` 表关联验证）
  - **功能**：
    - 首次调用：创建屏蔽记录（`is_active = true`）
    - 再次调用：切换屏蔽状态（`is_active = NOT is_active`）
    - 自动更新 `blocked_at`、`unblocked_at`、`last_action_at` 时间戳

- **`is_user_blocked(p_girl_id UUID, p_customer_id UUID)`** - 检查用户是否被屏蔽
  - **参数**：
    - `p_girl_id` - 技师ID
    - `p_customer_id` - 客户ID
  - **返回**：BOOLEAN
  - **权限**：已认证用户
  - **功能**：快速检查指定客户是否被技师屏蔽（`is_active = true`）

### 结算系统
- [settlement_girl_rpcs.md](./rpc/settlement_girl_rpcs.md) - 技师端结算功能
  - `check_girl_can_go_online()` - 检查是否可以上线
  - `record_girl_payment()` - 记录技师支付
  - `request_withdrawal()` - 申请提现
  - `get_girl_settlement_dashboard()` - 获取结算仪表盘

---

## 💼 后台管理端 RPC

### 服务管理
<!-- - [ops_rpcs.md](./rpc/ops_rpcs.md) -->

### 结算系统
- [settlement_admin_rpcs.md](./rpc/settlement_admin_rpcs.md) - 管理端结算功能
  - `record_customer_payment()` - 记录顾客支付给平台
  - `approve_withdrawal()` - 审核提现申请
  - `adjust_girl_balance()` - 人工调整余额
  - `get_settlement_report()` - 获取结算报表

---



## ⚙️ 触发器列表

### 当订单创建时，自动在 c2g 会话中插入"订单已创建"系统消息
- [notify_order_created.md](./trig/notify_order_created.md)

---




## 🌐 Edge Functions

> 位于 `supabase/functions/` 目录，用于服务端逻辑（HTTP 可调用）。  
> 每个函数独立部署，对应文件夹名即函数名。

### 技师端 Edge目录
- [edge/get-upload-url](../supabase/functions/get-upload-url/)
- [edge/remove-tmp](../supabase/functions/remove-tmp/)
- [edge/reorder](../supabase/functions/reorder/)

> Edge 逻辑通常涉及：外部 API 调用、异步队列、Webhook、缓存与安全操作。


---