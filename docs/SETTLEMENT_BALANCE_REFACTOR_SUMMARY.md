# girl_settlement_accounts 业务逻辑调整总结

## 📋 调整背景

**核心原则**：所有抽成全部用 THB 在系统里统一记账；平台代收 RMB 只在订单级别记录「金额 + 截图 + 时间」，由财务在一个轻量页面集中核对；技师不允许脱离订单上传平台收款，上传有时间窗口；结账和提现只针对两个独立的数：欠平台（THB）和平台代收（RMB），汇率只在提现时人工决定。

## 🔄 核心变更

### 1. `balance` 字段含义调整

**旧逻辑**：
- 正数 = 平台欠技师
- 负数 = 技师欠平台

**新逻辑**：
- **始终为正数或 0**
- 表示：技师当前欠平台的金额（THB）
- 用途：控制上线权限

### 2. 新增 `platform_collected_rmb_balance` 字段

- 类型：`DECIMAL(10,2) NOT NULL DEFAULT 0`
- 含义：平台代技师收款的累计金额（通常为人民币）
- 用途：技师提现的上限
- 特点：原币种金额直接累加，不做汇率换算

### 3. 业务规则

#### 上线规则
- 当 `balance >= deposit_amount * 0.8` 时 → 预警
- 当 `balance > deposit_amount` 时 → 禁止上线接单

#### 提现规则
- 当 `platform_collected_rmb_balance >= app_configs.settlement.min_withdrawal_amount_rmb` 时可提现
- 提现金额 ≤ `platform_collected_rmb_balance`

## 📝 已修改的文件

### ✅ 1. DB.md 文档

**文件**：`d:\github\cbody-ops\docs\DB.md`

**修改内容**：
- 更新 `girl_settlement_accounts` 表字段说明
- 新增 `platform_collected_rmb_balance` 字段
- 更新索引和约束说明
- 更新业务规则说明
- 更新 `settlement_transactions` 表说明（明确币种）

### ✅ 2. SQL 迁移脚本

**文件**：`d:\github\cbody-ops\docs\sql\alter_girl_settlement_accounts.sql`

**包含内容**：
1. 新增 `platform_collected_rmb_balance` 字段
2. 添加字段注释
3. 数据迁移：将负数 balance 转为正数
4. 删除旧索引，创建新索引
5. 添加 CHECK 约束

### ✅ 3. settlement_triggers.sql

**文件**：`d:\github\cbody-ops\docs\sql\settlement_triggers.sql`

**修改内容**：

#### 触发器 1：订单完成时
```sql
-- 旧逻辑：balance = balance - v_settlement_amount
-- 新逻辑：balance = balance + v_settlement_amount（累加欠款）
```

#### 触发器 2：订单结算调整时
```sql
-- 新增：同步 platform_collected_rmb_balance
-- 调整：balance 逻辑（欠款为正数）
```

#### 欠款检查逻辑
```sql
-- 80% 预警
IF v_balance >= v_deposit_amount * 0.8 THEN
  RAISE NOTICE '技师 % 欠款预警...';
END IF;

-- 超限禁止上线
IF v_balance > v_deposit_amount THEN
  RAISE NOTICE '技师 % 欠款超限，应禁止上线...';
END IF;
```

### ✅ 4. refactor_settlement_transactions.sql

**文件**：`d:\github\cbody-ops\docs\sql\refactor_settlement_transactions.sql`

**修改内容**：
- `settlement` 确认时：减少 `balance`（技师结账，欠款减少）
- `withdrawal` 确认时：减少 `platform_collected_rmb_balance`（技师提现，平台代收减少）

## 🔄 数据流向

### 订单完成流程

```
订单完成（status → completed）
  ↓
触发器创建 order_settlements 记录（status = pending）
  ↓
计算 platform_should_get（THB）
  ↓
暂不更新账户余额（等待核验）
```

### 订单核验流程

```
管理员核验订单（settlement_status: pending → settled）
  ↓
触发器自动更新账户
  ↓
1. balance += platform_should_get（THB 欠款累加）
  ↓
2. 若 payment_method in ('wechat','alipay') 且 actual_paid_amount > 0
   platform_collected_rmb_balance += actual_paid_amount（RMB 代收累加）
  ↓
检查是否超过欠款阈值
```

### 技师结账流程

```
技师上传付款截图 → settlement_transactions (settlement, pending)
  ↓
管理员审核确认 → status = confirmed
  ↓
触发器自动更新
  ↓
balance -= 结账金额（欠款减少）
```

### 技师提现流程

```
技师申请提现 → settlement_transactions (withdrawal, pending)
  ↓
管理员审核确认 → status = confirmed
  ↓
触发器自动更新
  ↓
platform_collected_rmb_balance -= 提现金额
```

## 📊 字段对比表

| 字段 | 旧含义 | 新含义 | 币种 |
|------|--------|--------|------|
| `balance` | 正数=平台欠技师<br>负数=技师欠平台 | 技师欠平台的金额<br>（始终 ≥ 0） | THB |
| `platform_collected_rmb_balance` | ❌ 不存在 | 平台代收累计金额 | RMB |
| `deposit_amount` | 定金总额 | 定金总额（同时作为欠款阈值） | THB |

## 🚀 执行步骤

### 1. 备份数据
```sql
CREATE TABLE girl_settlement_accounts_backup AS 
SELECT * FROM girl_settlement_accounts;
```

### 2. 执行迁移
```bash
psql -U your_user -d your_database -f docs/sql/alter_girl_settlement_accounts.sql
```

### 3. 更新触发器
```bash
psql -U your_user -d your_database -f docs/sql/settlement_triggers.sql
```

### 4. 更新 settlement_transactions 触发器
```bash
psql -U your_user -d your_database -f docs/sql/refactor_settlement_transactions.sql
```

### 5. 验证
```sql
-- 检查字段是否添加成功
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'girl_settlement_accounts';

-- 检查约束是否添加成功
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_schema = 'public' 
  AND constraint_name LIKE 'girl_settlement_accounts%';

-- 检查索引是否创建成功
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'girl_settlement_accounts';
```

## ⚠️ 注意事项

1. **数据迁移**：
   - 旧的负数 balance 会被转为正数（绝对值）
   - 旧的正数 balance 会被清零（需要人工核对）
   - 建议在迁移前备份数据

2. **前端/API 调整**：
   - 所有读取 `balance` 的地方需要调整逻辑
   - 新增 `platform_collected_rmb_balance` 的显示
   - 上线检查逻辑需要调整（从 `balance < -deposit_amount` 改为 `balance > deposit_amount`）

3. **业务流程**：
   - 技师结账只能减少 `balance`（THB）
   - 技师提现只能减少 `platform_collected_rmb_balance`（RMB）
   - 两个字段完全独立，互不影响

## 📚 相关文档

- 数据库文档：`docs/DB.md`
- SQL 迁移脚本：`docs/sql/alter_girl_settlement_accounts.sql`
- 触发器文件：`docs/sql/settlement_triggers.sql`
- 重构脚本：`docs/sql/refactor_settlement_transactions.sql`

---

**调整完成日期**：2025-11-22  
**调整人**：Cascade AI Assistant
