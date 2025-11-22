# 技师结算账户管理功能设计

## 📋 设计原则

1. **轻量级**：最小化查询次数，减少复杂逻辑，优先使用数据库触发器
2. **易操作**：清晰的视觉层次，一键批量操作，智能默认值
3. **符合规范**：遵循 AGENTS.md 规范，使用 shadcn/ui，支持响应式和暗黑模式
4. **风控优先**：实时展示欠款状态，明确预警和超限标识

---

## 🎯 功能模块设计

### 模块 1：技师结算账户总览

**路由**：`/dashboard/finance/accounts`

**核心功能**：
- 展示所有技师的结算账户状态
- 支持按城市、状态、关键字筛选
- 一目了然的欠款状态标识

**页面布局**：

```
┌─────────────────────────────────────────────────────────────┐
│ 技师结算账户                                    [导出数据]   │
├─────────────────────────────────────────────────────────────┤
│ 📊 统计卡片区域（4列）                                       │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │ 总技师数  │ │ 正常     │ │ 预警     │ │ 超限     │        │
│ │ 128      │ │ 98       │ │ 23       │ │ 7        │        │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
├─────────────────────────────────────────────────────────────┤
│ 🔍 筛选区域                                                  │
│ [城市 ▼] [状态 ▼] [搜索技师姓名/工号...]                    │
├─────────────────────────────────────────────────────────────┤
│ 📋 技师列表表格                                              │
│ ┌────┬────────┬──────┬────────┬────────┬────────┬────────┐ │
│ │头像│ 姓名   │ 城市 │ 押金   │ 欠款   │ 代收   │ 状态   │ │
│ ├────┼────────┼──────┼────────┼────────┼────────┼────────┤ │
│ │ 👤 │ 小美   │ 曼谷 │ 5000   │ 4200   │ 3800   │ 🟡预警 │ │
│ │    │ #G001  │      │        │        │        │        │ │
│ ├────┼────────┼──────┼────────┼────────┼────────┼────────┤ │
│ │ 👤 │ 小红   │ 清迈 │ 5000   │ 5200   │ 1200   │ 🔴超限 │ │
│ │    │ #G002  │      │        │        │        │        │ │
│ └────┴────────┴──────┴────────┴────────┴────────┴────────┘ │
│ [上一页] 1 / 10 [下一页]                                     │
└─────────────────────────────────────────────────────────────┘
```

**字段说明**：
- **押金**：`deposit_amount` (THB)
- **欠款**：`balance` (THB)，显示进度条（欠款/押金比例）
- **代收**：`platform_collected_rmb_balance` (RMB)
- **状态标签**：
  - 🟢 正常：`balance < deposit_amount * 0.8`
  - 🟡 预警：`balance >= deposit_amount * 0.8 && balance <= deposit_amount`
  - 🔴 超限：`balance > deposit_amount`

**交互**：
- 点击行 → 跳转到技师账户详情页
- 导出按钮 → 导出当前筛选结果为 CSV

---

### 模块 2：技师账户详情页

**路由**：`/dashboard/finance/accounts/[girl_id]`

**核心功能**：
- 展示单个技师的完整结算信息
- 订单核验记录和资金流水
- 支持快速操作（调整押金、标记豁免等）

**页面布局**：

```
┌─────────────────────────────────────────────────────────────┐
│ ← 返回列表    技师账户详情 - 小美 (#G001)                    │
├─────────────────────────────────────────────────────────────┤
│ 👤 基本信息                                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 头像  姓名：小美  工号：#G001  城市：曼谷                │ │
│ │ 手机：+66-xxx-xxxx  状态：🟡 预警                        │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ 💰 账户余额（3列卡片）                                       │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │ 押金 (THB)   │ │ 欠款 (THB)   │ │ 代收 (RMB)   │        │
│ │ 5,000.00     │ │ 4,200.00     │ │ 3,800.00     │        │
│ │              │ │ ████████░░ 84%│ │ 可提现       │        │
│ │ [调整押金]   │ │ [查看明细]   │ │ [查看明细]   │        │
│ └──────────────┘ └──────────────┘ └──────────────┘        │
├─────────────────────────────────────────────────────────────┤
│ 📊 Tabs 切换区域                                             │
│ [订单核验记录] [结账/提现记录] [操作日志]                    │
│                                                              │
│ Tab 1: 订单核验记录                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 筛选：[日期范围] [核验状态] [是否平台代收]              │ │
│ │                                                          │ │
│ │ 订单号      │ 完成时间   │ 应得  │ 代收  │ 状态        │ │
│ │ ORD-001     │ 2024-11-21 │ 800   │ 1200  │ ✅ 已核验   │ │
│ │ ORD-002     │ 2024-11-21 │ 600   │ -     │ ⏳ 待核验   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Tab 2: 结账/提现记录                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 类型    │ 金额    │ 申请时间   │ 状态      │ 操作      │ │
│ │ 结账    │ 2000 ฿  │ 2024-11-20 │ ✅ 已确认 │ [查看]    │ │
│ │ 提现    │ 1500 ¥  │ 2024-11-19 │ ⏳ 待审核 │ [审核]    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**关键功能**：
1. **调整押金**：弹窗输入新押金金额，记录操作日志
2. **查看明细**：展开查看欠款/代收的来源订单
3. **快速审核**：直接在列表中审核结账/提现申请

---

### 模块 3：财务日订单核验

**路由**：`/dashboard/finance/daily-verification`

**核心功能**：
- 按财务日（06:00-06:00）展示待核验订单
- 支持批量核验和单个编辑
- 实时统计和异常提示

**页面布局**：

```
┌─────────────────────────────────────────────────────────────┐
│ 财务日订单核验                                               │
├─────────────────────────────────────────────────────────────┤
│ 📅 财务日选择                                                │
│ [昨天 06:00 - 今天 06:00 ▼]  [刷新]                         │
├─────────────────────────────────────────────────────────────┤
│ 📊 统计卡片（4列）                                           │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │ 总订单数  │ │ 待核验   │ │ 已核验   │ │ 异常订单 │        │
│ │ 156      │ │ 23       │ │ 133      │ │ 3        │        │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
├─────────────────────────────────────────────────────────────┤
│ 🔍 筛选区域                                                  │
│ [技师 ▼] [核验状态 ▼] [是否平台代收 ▼] [批量核验选中]      │
├─────────────────────────────────────────────────────────────┤
│ 📋 订单列表                                                  │
│ ┌─┬────────┬──────┬──────┬──────┬──────┬──────┬────────┐   │
│ │☑│订单号  │技师  │应得  │顾客付│代收  │状态  │ 操作   │   │
│ ├─┼────────┼──────┼──────┼──────┼──────┼──────┼────────┤   │
│ │☑│ORD-001 │小美  │ 800  │ 0    │ 1200 │⏳待核│[编辑]  │   │
│ │☑│ORD-002 │小红  │ 600  │ 600  │ -    │⏳待核│[编辑]  │   │
│ │☐│ORD-003 │小丽  │ 900  │ 0    │ 900  │✅已核│[查看]  │   │
│ └─┴────────┴──────┴──────┴──────┴──────┴──────┴────────┘   │
│                                                              │
│ [批量核验选中 (2)] [导出当日数据]                            │
└─────────────────────────────────────────────────────────────┘
```

**编辑弹窗**：
```
┌─────────────────────────────────────┐
│ 编辑订单核验信息 - ORD-001          │
├─────────────────────────────────────┤
│ 订单号：ORD-001                     │
│ 技师：小美 (#G001)                  │
│ 平台应得抽成：800.00 THB            │
│                                     │
│ 顾客直接付平台 (THB)：              │
│ [________] THB                      │
│                                     │
│ 平台代收金额 (RMB)：                │
│ [1200.00] RMB                       │
│                                     │
│ 支付方式：                          │
│ [微信支付 ▼]                        │
│                                     │
│ 备注：                              │
│ [________________]                  │
│                                     │
│ [取消] [保存] [保存并核验]          │
└─────────────────────────────────────┘
```

---

### 模块 4：结账/提现申请管理

**路由**：`/dashboard/finance/transactions`

**核心功能**：
- 展示所有待审核的结账/提现申请
- 支持快速审核和批量操作
- 查看凭证截图

**页面布局**：

```
┌─────────────────────────────────────────────────────────────┐
│ 结账/提现申请管理                                            │
├─────────────────────────────────────────────────────────────┤
│ 📊 统计卡片（3列）                                           │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│ │ 待审核   │ │ 今日已审 │ │ 今日金额 │                     │
│ │ 12       │ │ 35       │ │ ¥28,500  │                     │
│ └──────────┘ └──────────┘ └──────────┘                     │
├─────────────────────────────────────────────────────────────┤
│ 🔍 筛选区域                                                  │
│ [类型 ▼] [状态 ▼] [城市 ▼] [技师搜索...]                    │
├─────────────────────────────────────────────────────────────┤
│ 📋 申请列表                                                  │
│ ┌────────┬──────┬──────┬──────┬────────┬────────┬────────┐ │
│ │ 类型   │ 技师 │ 金额 │ 方式 │ 申请时间│ 状态   │ 操作   │ │
│ ├────────┼──────┼──────┼──────┼────────┼────────┼────────┤ │
│ │ 🔵结账 │ 小美 │ 2000 │ 微信 │ 11-21  │ ⏳待审 │[审核]  │ │
│ │        │#G001 │ THB  │      │ 14:30  │        │        │ │
│ ├────────┼──────┼──────┼──────┼────────┼────────┼────────┤ │
│ │ 🟢提现 │ 小红 │ 1500 │ 银行 │ 11-21  │ ⏳待审 │[审核]  │ │
│ │        │#G002 │ RMB  │      │ 10:15  │        │        │ │
│ └────────┴──────┴──────┴──────┴────────┴────────┴────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**审核弹窗**：
```
┌─────────────────────────────────────┐
│ 审核结账申请                        │
├─────────────────────────────────────┤
│ 技师：小美 (#G001)                  │
│ 类型：结账给平台                    │
│ 金额：2,000.00 THB                  │
│ 方式：微信支付                      │
│ 申请时间：2024-11-21 14:30          │
│                                     │
│ 付款凭证：                          │
│ [查看截图 🖼️]                       │
│                                     │
│ 当前账户状态：                      │
│ • 欠款余额：4,200.00 THB            │
│ • 核验后：2,200.00 THB              │
│                                     │
│ 备注（可选）：                      │
│ [________________]                  │
│                                     │
│ [取消] [作废] [确认通过]            │
└─────────────────────────────────────┘
```

---

## 🔧 技术实现方案

### 1. 路由结构

```
/dashboard/finance/
├── accounts/                    # 技师结算账户总览
│   └── [girl_id]/              # 技师账户详情
├── daily-verification/          # 财务日订单核验
└── transactions/                # 结账/提现申请管理
```

### 2. Server Actions 设计

```typescript
// lib/features/settlement/actions.ts

// 技师账户相关
export async function getSettlementAccounts(params: AccountsFilterParams)
export async function getAccountDetail(girlId: string)
export async function updateDepositAmount(girlId: string, amount: number)

// 订单核验相关
export async function getDailyVerificationOrders(fiscalDate: Date)
export async function updateOrderSettlement(orderId: string, data: UpdateSettlementData)
export async function batchVerifyOrders(orderIds: string[])

// 结账/提现相关
export async function getTransactionApplications(params: TransactionFilterParams)
export async function approveTransaction(txId: string, notes?: string)
export async function cancelTransaction(txId: string, reason: string)
```

### 3. 数据类型定义

```typescript
// lib/features/settlement/types.ts

export interface SettlementAccount {
  id: string
  girl_id: string
  girl: {
    id: string
    name: string
    employee_number: string
    avatar_url: string | null
    city: { name: { zh: string } }
  }
  deposit_amount: number
  balance: number
  platform_collected_rmb_balance: number
  status: 'normal' | 'warning' | 'exceeded'
  debt_ratio: number  // balance / deposit_amount
}

export interface OrderSettlementRecord {
  id: string
  order_id: string
  order_number: string
  girl_id: string
  platform_should_get: number
  customer_paid_to_platform: number
  actual_paid_amount: number | null
  settlement_amount: number
  payment_method: string | null
  payment_content_type: string | null
  settlement_status: 'pending' | 'settled'
  settled_at: string | null
  created_at: string
}

export interface TransactionApplication {
  id: string
  girl_id: string
  transaction_type: 'settlement' | 'withdrawal'
  direction: 'to_platform' | 'to_girl'
  amount: number
  payment_method: string | null
  payment_proof_url: string | null
  notes: string | null
  status: 'pending' | 'confirmed' | 'cancelled'
  operator_id: string | null
  confirmed_at: string | null
  created_at: string
}
```

### 4. 组件结构

```
app/dashboard/finance/
├── accounts/
│   ├── page.tsx                           # 账户总览页
│   ├── accounts-list-content.tsx          # 列表内容组件
│   ├── account-status-badge.tsx           # 状态标签组件
│   └── [girl_id]/
│       ├── page.tsx                       # 账户详情页
│       ├── account-detail-header.tsx      # 详情头部
│       ├── account-balance-cards.tsx      # 余额卡片
│       └── account-tabs.tsx               # Tabs 组件
├── daily-verification/
│   ├── page.tsx                           # 核验页
│   ├── verification-list.tsx              # 订单列表
│   ├── edit-settlement-dialog.tsx         # 编辑弹窗
│   └── batch-verify-button.tsx            # 批量核验按钮
└── transactions/
    ├── page.tsx                           # 申请管理页
    ├── transactions-list.tsx              # 申请列表
    ├── approve-dialog.tsx                 # 审核弹窗
    └── proof-image-viewer.tsx             # 凭证查看器
```

---

## 📊 数据库查询优化

### 1. 技师账户列表查询

```sql
-- 使用 JOIN 一次性获取所有需要的数据
SELECT 
  gsa.*,
  g.name,
  g.employee_number,
  g.avatar_url,
  c.name as city_name,
  CASE 
    WHEN gsa.balance > gsa.deposit_amount THEN 'exceeded'
    WHEN gsa.balance >= gsa.deposit_amount * 0.8 THEN 'warning'
    ELSE 'normal'
  END as status,
  CASE 
    WHEN gsa.deposit_amount > 0 THEN gsa.balance / gsa.deposit_amount
    ELSE 0
  END as debt_ratio
FROM girl_settlement_accounts gsa
JOIN girls g ON g.id = gsa.girl_id
JOIN cities c ON c.id = g.city_id
WHERE 1=1
  -- 筛选条件
ORDER BY gsa.balance DESC
LIMIT 20 OFFSET 0;
```

### 2. 财务日订单查询

```sql
-- 使用时间范围和索引优化查询
SELECT 
  os.*,
  o.order_number,
  o.completed_at,
  g.name as girl_name,
  g.employee_number
FROM order_settlements os
JOIN orders o ON o.id = os.order_id
JOIN girls g ON g.id = os.girl_id
WHERE o.completed_at >= $1  -- 昨天 06:00
  AND o.completed_at < $2   -- 今天 06:00
ORDER BY os.settlement_status ASC, o.completed_at DESC;
```

### 3. 结账/提现申请查询

```sql
-- 优先展示待审核的申请
SELECT 
  st.*,
  g.name as girl_name,
  g.employee_number,
  g.avatar_url,
  c.name as city_name
FROM settlement_transactions st
JOIN girls g ON g.id = st.girl_id
JOIN cities c ON c.id = g.city_id
WHERE st.status = 'pending'
ORDER BY st.created_at ASC;
```

---

## 🎨 UI 组件规范

### 1. 状态标签

```tsx
// 欠款状态
<Badge variant="default">🟢 正常</Badge>
<Badge variant="warning">🟡 预警</Badge>
<Badge variant="destructive">🔴 超限</Badge>

// 核验状态
<Badge variant="secondary">⏳ 待核验</Badge>
<Badge variant="default">✅ 已核验</Badge>

// 申请状态
<Badge variant="secondary">⏳ 待审核</Badge>
<Badge variant="default">✅ 已确认</Badge>
<Badge variant="outline">❌ 已作废</Badge>
```

### 2. 进度条

```tsx
// 欠款进度条
<Progress 
  value={debtRatio * 100} 
  className={cn(
    debtRatio >= 1 ? "bg-red-500" :
    debtRatio >= 0.8 ? "bg-yellow-500" :
    "bg-green-500"
  )}
/>
```

### 3. 金额显示

```tsx
// THB 金额
<span className="font-mono">{amount.toLocaleString('th-TH')} ฿</span>

// RMB 金额
<span className="font-mono">{amount.toLocaleString('zh-CN')} ¥</span>
```

---

## ⚡ 性能优化策略

1. **分页加载**：每页 20 条记录，使用 `LIMIT` 和 `OFFSET`
2. **索引优化**：确保 `girl_id`、`settlement_status`、`status`、`created_at` 有索引
3. **缓存策略**：统计数据使用 5 分钟缓存
4. **批量操作**：批量核验使用事务，一次性更新多条记录
5. **懒加载**：凭证图片使用懒加载，点击时才加载

---

## 🔒 权限控制

```typescript
// 所有操作需要管理员权限
await requireAdmin(['superadmin', 'admin', 'finance'])

// 审计日志记录
await logAction(
  admin.id,
  'approve_transaction',
  transaction.id,
  { amount, type, girl_id }
)
```

---

## 📝 操作日志记录

每个关键操作都记录到 `admin_operation_logs`：

```typescript
{
  operator_id: admin.id,
  action: 'approve_settlement_transaction',
  target_type: 'settlement_transaction',
  target_id: transaction.id,
  payload: {
    girl_id: transaction.girl_id,
    amount: transaction.amount,
    type: transaction.transaction_type,
    before_balance: accountBefore.balance,
    after_balance: accountAfter.balance
  },
  notes: '财务审核通过'
}
```

---

## 🚀 开发优先级

### Phase 1：核心功能（1-2 天）
1. ✅ 技师结算账户总览页
2. ✅ 技师账户详情页（基础信息 + 余额卡片）
3. ✅ 财务日订单核验页（列表 + 单个编辑）

### Phase 2：审核功能（1 天）
4. ✅ 结账/提现申请管理页
5. ✅ 审核弹窗 + 凭证查看

### Phase 3：增强功能（1 天）
6. ✅ 批量核验功能
7. ✅ 数据导出功能
8. ✅ 操作日志展示

---

## 📌 注意事项

1. **货币单位**：始终明确显示 THB 或 RMB，避免混淆
2. **时区处理**：财务日使用泰国时区（UTC+7），06:00 为分界点
3. **小数精度**：金额统一保留 2 位小数
4. **错误处理**：所有操作失败时显示友好提示，记录错误日志
5. **并发控制**：审核操作使用乐观锁，避免重复审核

---

**设计完成日期**：2024-11-22  
**设计人**：Cascade AI Assistant
