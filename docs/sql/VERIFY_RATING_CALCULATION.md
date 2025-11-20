# 评分计算验证

## 修复的 BUG

**问题**：BEFORE UPDATE 触发器中，NEW 记录还未提交到数据库，直接统计会漏掉当前这条评论。

**修复**：手动加上当前评论的数据。

---

## 正确的计算示例

### 场景 1：第一条差评（1分）

**初始状态**：
- rating = 0.0
- total_reviews = 0

**审核通过后**：
```
已通过评论数 n = 1
总分 sum = 1.0

final_rating = (25 * 4.5 + 1.0) / (25 + 1)
             = (112.5 + 1.0) / 26
             = 113.5 / 26
             = 4.365...
             ≈ 4.37（保留两位小数）
```

**结果**：
- rating = 4.37
- total_reviews = 1

---

### 场景 2：第二条好评（5分）

**当前状态**：
- rating = 4.37
- total_reviews = 1

**审核通过后**：
```
已通过评论数 n = 2
总分 sum = 1.0 + 5.0 = 6.0

final_rating = (25 * 4.5 + 6.0) / (25 + 2)
             = (112.5 + 6.0) / 27
             = 118.5 / 27
             = 4.388...
             ≈ 4.39（保留两位小数）
```

**结果**：
- rating = 4.39
- total_reviews = 2

---

### 场景 3：第三条好评（5分）

**当前状态**：
- rating = 4.39
- total_reviews = 2

**审核通过后**：
```
已通过评论数 n = 3
总分 sum = 1.0 + 5.0 + 5.0 = 11.0

final_rating = (25 * 4.5 + 11.0) / (25 + 3)
             = (112.5 + 11.0) / 28
             = 123.5 / 28
             = 4.410...
             ≈ 4.41（保留两位小数）
```

**结果**：
- rating = 4.41
- total_reviews = 3

---

## 验证 SQL

```sql
-- 1. 重置技师评分（测试前）
UPDATE girls 
SET rating = 0, total_reviews = 0 
WHERE id = 'your_girl_id';

-- 2. 审核第一条评论（1分差评）
UPDATE order_reviews 
SET status = 'approved', reviewed_by = 'admin_id', reviewed_at = NOW()
WHERE id = 'review_1_id';

-- 3. 检查结果（应该是 4.37, 1）
SELECT rating, total_reviews FROM girls WHERE id = 'your_girl_id';

-- 4. 审核第二条评论（5分好评）
UPDATE order_reviews 
SET status = 'approved', reviewed_by = 'admin_id', reviewed_at = NOW()
WHERE id = 'review_2_id';

-- 5. 检查结果（应该是 4.39, 2）
SELECT rating, total_reviews FROM girls WHERE id = 'your_girl_id';
```

---

## 边界情况

### 0 评论
```
n = 0
final_rating = 0（特殊处理，避免除以0）
```

### 25 条评论（先验权重临界点）
```
假设全是 5 分：
sum = 25 * 5 = 125

final_rating = (25 * 4.5 + 125) / (25 + 25)
             = (112.5 + 125) / 50
             = 237.5 / 50
             = 4.75
```

### 100 条评论（实际评分主导）
```
假设全是 5 分：
sum = 100 * 5 = 500

final_rating = (25 * 4.5 + 500) / (25 + 100)
             = (112.5 + 500) / 125
             = 612.5 / 125
             = 4.90
```

---

## 修复前的错误行为

**第一条 1 分差评**：
- 错误：rating = 4.5, total_reviews = 0
- 原因：统计时漏掉了当前这条，n=0，sum=0，计算结果 = (112.5 + 0) / 25 = 4.5

**第二条 5 分好评**：
- 错误：rating = 4.3, total_reviews = 1
- 原因：统计时只算到第一条，n=1，sum=1，计算结果 = (112.5 + 1) / 26 = 4.37（但显示为4.3可能是四舍五入问题）

---

## 修复后的正确行为

**第一条 1 分差评**：
- ✅ rating = 4.37, total_reviews = 1

**第二条 5 分好评**：
- ✅ rating = 4.39, total_reviews = 2
