# 评论审核触发器部署指南

## 功能概述

实现评论审核的完整逻辑：

1. **状态锁定**：`approved` 或 `rejected` 后不可再修改
2. **Bayesian 评分重算**：审核通过时自动更新技师评分
3. **技师统计更新**：自动更新 `girls.total_reviews` 和 `girls.rating`

## 部署步骤

### 1. 执行 SQL 脚本

在 Supabase SQL Editor 中执行：

```bash
docs/sql/review_approval_trigger.sql
```

### 2. 验证触发器

```sql
-- 查看触发器是否创建成功
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table, 
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_review_approval';
```

### 3. 测试触发器

```sql
-- 1. 创建测试评论（假设已有订单和技师）
INSERT INTO order_reviews (
    order_id, 
    user_id, 
    girl_id, 
    service_id,
    rating_service,
    rating_attitude,
    rating_emotion,
    rating_similarity,
    rating_overall,
    status
) VALUES (
    'your_order_id',
    'your_user_id',
    'your_girl_id',
    1,
    5, 5, 5, 5,
    5.00,
    'pending'
);

-- 2. 审核通过（应自动更新技师评分）
UPDATE order_reviews 
SET 
    status = 'approved',
    reviewed_by = 'admin_user_id',
    reviewed_at = NOW()
WHERE id = 'review_id';

-- 3. 验证技师评分是否更新
SELECT 
    id,
    girl_number,
    name,
    rating,
    total_reviews
FROM girls
WHERE id = 'your_girl_id';
```

## Bayesian 评分公式

```
final_rating = (C * m + sum(rating_overall)) / (C + n)

其中：
- m = 4.5  （先验平均分）
- C = 25   （先验权重，相当于25条4.5分的虚拟评论）
- n = approved_count （已通过的评论数）
- sum(rating_overall) = 所有已通过评论的总分
```

### 示例计算

假设技师有 3 条已通过的评论，评分分别为 5.0, 4.5, 4.8：

```
sum = 5.0 + 4.5 + 4.8 = 14.3
n = 3
final_rating = (25 * 4.5 + 14.3) / (25 + 3)
             = (112.5 + 14.3) / 28
             = 126.8 / 28
             = 4.53
```

## 手动修复评分

如果需要手动重算某个技师的评分：

```sql
-- 单个技师
SELECT recalculate_girl_rating('girl_uuid_here');

-- 批量修复所有有评论的技师
SELECT recalculate_girl_rating(id) 
FROM girls 
WHERE id IN (
    SELECT DISTINCT girl_id 
    FROM order_reviews 
    WHERE status = 'approved'
);
```

## 状态锁定规则

| 当前状态 | 可变更为 | 是否允许 |
|---------|---------|---------|
| pending | approved | ✅ 允许 |
| pending | rejected | ✅ 允许 |
| approved | rejected | ❌ 禁止 |
| approved | pending | ❌ 禁止 |
| rejected | approved | ❌ 禁止 |
| rejected | pending | ❌ 禁止 |

## 错误处理

如果尝试修改已审核的评论，会收到错误：

```
ERROR: 已审核的评论状态不可修改（当前状态：approved）
```

## 日志输出

触发器执行时会输出日志（可在 Supabase Logs 中查看）：

```
NOTICE: [评论审核] 技师 xxx 评分已更新：4.53（共 3 条评论）
```

## 注意事项

1. **幂等性**：同一评论多次审核不会重复计算
2. **原子性**：评分更新与状态变更在同一事务中
3. **性能**：每次审核只查询一次该技师的所有评论
4. **回滚**：如果评分更新失败，整个审核操作会回滚

## 相关文件

- SQL 脚本：`docs/sql/review_approval_trigger.sql`
- Server Actions：`app/dashboard/operations/reviews/actions.ts`
- 前端 UI：`components/operations/reviews/ReviewDrawer.tsx`
