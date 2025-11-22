## 一、当前业务 & 数据结构要点（功能视角）

* **结算账户：girl_settlement_accounts**

  * 每个技师一条记录，包含：

    * `deposit_amount`：技师已付平台押金（同时是欠款阈值）。
    * `balance`：以 THB 计的“技师欠平台金额”，正数=欠平台；0=结清。
    * `platform_collected_rmb_balance`：平台代客收款（微信/支付宝等）的累计人民币金额，表示“平台欠技师”。

* **订单核验：order_settlements**

  * 订单完成后自动生成一条核验记录，包含：

    * `platform_should_get`：平台应得抽成（按服务费/额外费和提成比例计算）。
    * `customer_paid_to_platform`：顾客直接付给平台的 THB 金额。
    * `actual_paid_amount`：顾客用人民币等其他币种付给平台的金额（主要是 RMB）。
    * `settlement_amount = platform_should_get - customer_paid_to_platform` 由触发器自动维护。
    * `payment_method` / `payment_content_type` / `payment_notes` 用于标记是否走平台收款码（微信/支付宝）、定金/全款等。
  * 订单从 `pending` → `settled` 时，触发器同步更新技师账户：

    * 把本单平台应得抽成累加到 `girl_settlement_accounts.balance`。
    * 若使用微信/支付宝且有 `actual_paid_amount`，累加到 `platform_collected_rmb_balance`。

* **真实资金流动：settlement_transactions**

  * 只记录两类动作：

    * `transaction_type = 'settlement'`（技师结账→平台），`direction = 'to_platform'`。
    * `transaction_type = 'withdrawal'`（技师提现←平台），`direction = 'to_girl'`。
  * 不再关联具体订单，只记录 **一次打款/结账申请** 的金额、方式、凭证截图、状态。
  * 当 `status` 从 `pending` → `confirmed` 时，触发器自动更新技师账户：

    * 结账：`balance = balance - amount`（技师欠款减少）。
    * 提现：`platform_collected_rmb_balance = platform_collected_rmb_balance - amount`（平台欠技师减少）。

* **工作日逻辑**

  * 结算周期按财务日：每天 06:00–次日 06:00 为一个核验周期。
  * 财务每天核验上一财务日的订单：确认是否完成、是否有平台代收（微信/支付宝）、金额是否一致，然后标记为 `settled`。

* **风控规则（基于账户字段）**

  * 当 `balance` ≥ `deposit_amount * 0.8` 发出预警。
  * 当 `balance` > `deposit_amount` 时，技师应被限制继续上线接单，必须先结账或补押金。
  * 提现需满足：`platform_collected_rmb_balance` ≥ 系统配置的最小提现额度（`app_configs.settlement.default_min_withdrawal`）。

---

## 二、后端管理需要开发的功能（轻量版需求）

### 1. 财务日订单核验服务

* 支持按财务日（默认昨天 06:00–今天 06:00）拉取所有 `order_settlements` 记录（含技师/订单号/服务费/平台应得/顾客已付/支付方式等）。
* 支持管理员逐单或批量更新：

  * `customer_paid_to_platform`、`actual_paid_amount`、`payment_method`、`payment_notes`。
  * 将状态从 `pending` 改为 `settled`，触发余额同步逻辑。
* 提供统计：

  * 本财务日每个技师的 THB 应收合计、平台代收 RMB 合计。
  * 未核验订单数量、异常订单（金额不平、备注有标记）的数量。

### 2. 技师结算账户总览 API

* 基于 `girl_settlement_accounts` 提供列表接口：

  * 显示：技师头像/工号/城市、`deposit_amount`、`balance`、`platform_collected_rmb_balance`、当前欠款状态标签（正常/预警/超限）。
* 支持按城市、状态（正常/预警/超限）、关键字（姓名/工号）筛选。
* 支持导出当日/当期数据用于线下对账（CSV 或简单 JSON）。

### 3. 技师账户详情视图服务

* 单个技师维度提供“流水明细”：

  * 订单层：最近 N 条 `order_settlements`（含是否平台代收、金额、付款方式）。
  * 真实资金层：最近 N 条 `settlement_transactions`（结账/提现申请及状态）。
  * 实时展示当前：`deposit_amount`、`balance`、`platform_collected_rmb_balance`、可提现额度。
* 支持按日期区间、订单状态、是否平台代收等过滤。

### 4. 结账/提现申请管理服务

* 技师端发起：

  * 结账申请：指定金额（<= 当前 `balance`），上传付款截图，选择支付方式。
  * 提现申请：指定金额（<= 当前 `platform_collected_rmb_balance` 且 ≥ 最小提现额）。
* 后端提供给 OPS 的功能：

  * 查询 `settlement_transactions` 中所有 `pending` 记录（支持按城市/技师/类型筛选）。
  * 审核通过：更新 `status = 'confirmed'`，由触发器自动修改技师账户余额并记录 `confirmed_at` 和 `operator_id`。
  * 审核作废：更新 `status = 'cancelled'`，不影响余额，但保留记录和备注。

### 5. 阈值与规则配置管理

* 使用 `app_configs` 维护以下配置：

  * 默认服务提成比例、额外费用提成比例。
  * 最小提现额度（RMB）。
  * 欠款预警比例（默认 0.8）和超限策略。
* 提供只读接口给客户端/技师端，用于展示“当前规则”（例如：最低提现 2000 RMB，欠款超过押金将被暂停上线等）。

### 6. 上线资格检查服务（风控）

* 在技师切换为“上线工作”前调用：

  * 检查 `girl_settlement_accounts.balance` 与 `deposit_amount` 的关系。
  * 超过阈值则返回错误码和提示文案，拒绝上线。
* 预留接口/标记：允许财务或管理员临时“豁免”某个技师一段时间（可通过单独字段或 app_configs 特例设置实现）。

### 7. 审计与操作日志

* 每次订单核验修改、结账/提现审核、管理员调整账户（若有）都写入 `admin_operation_logs`：

  * 记录操作人、技师、金额、前后数值快照、原因备注，方便审计。

---