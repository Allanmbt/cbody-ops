# 在线统计字段迁移指南

## 变更概述

将技师在线统计从"月-季度"改为"7天-月"统计：

| 旧字段名 | 新字段名 | 说明 |
|---------|---------|------|
| `monthly_online_seconds` | `weekly_online_seconds` | 月统计 → 7天统计 |
| `monthly_anchor` | `weekly_anchor` | 月锚点 → 7天锚点 |
| `quarterly_online_seconds` | `monthly_online_seconds` | 季度统计 → 月统计 |
| `quarterly_anchor` | `monthly_anchor` | 季度锚点 → 月锚点 |

## 迁移步骤

### 1. 备份数据（重要！）

```sql
-- 导出 girls_status 表数据
COPY girls_status TO '/tmp/girls_status_backup.csv' CSV HEADER;

-- 或使用 pg_dump
pg_dump -h your-host -U your-user -d your-db -t girls_status > girls_status_backup.sql
```

### 2. 执行字段重命名

在 Supabase SQL Editor 中执行：

```bash
\i docs/sql/rename_online_stats_fields.sql
```

或直接复制粘贴 `rename_online_stats_fields.sql` 文件内容执行。

**此脚本会：**
- 重命名 4 个字段
- 删除旧索引并创建新索引
- 更新 CHECK 约束

### 3. 更新 RPC 函数

在 Supabase SQL Editor 中执行：

```bash
\i docs/sql/update_rpcs_for_7day_stats.sql
```

或直接复制粘贴 `update_rpcs_for_7day_stats.sql` 文件内容执行。

**此脚本会更新：**
- `get_me_dashboard()` - 返回 7天+月统计
- `girl_go_offline()` - 计算 7天+月在线时长

### 4. 验证迁移

```sql
-- 1. 验证字段重命名
SELECT 
  column_name, 
  data_type
FROM information_schema.columns
WHERE table_name = 'girls_status' 
  AND column_name LIKE '%online%' OR column_name LIKE '%anchor%'
ORDER BY ordinal_position;

-- 2. 验证索引
SELECT indexname 
FROM pg_indexes
WHERE tablename = 'girls_status' 
  AND (indexname LIKE '%weekly%' OR indexname LIKE '%monthly%');

-- 3. 验证RPC函数
SELECT routine_name 
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_me_dashboard', 'girl_go_offline');

-- 4. 测试 RPC 调用
SELECT * FROM get_me_dashboard();
```

### 5. 前端代码部署

前端代码已经更新完毕，包括：
- ✅ `features/me/api/types.ts` - TypeScript 类型定义
- ✅ `features/me/components/OnlineTimeCard.tsx` - UI 显示组件
- ✅ `features/me/screens/MeScreen.tsx` - Me 页面
- ✅ `docs/DB.md` - 数据库文档
- ✅ `docs/sql/me_rpcs.sql` - RPC 文档
- ✅ `docs/sql/girl_status_setup.sql` - 安装脚本

**部署后前端将显示：**
- Last 7 Days（最近7天）
- This Month（本月）
- Total（总计）

## 回滚方案

如果需要回滚，执行以下 SQL：

```sql
BEGIN;

-- 反向重命名
ALTER TABLE girls_status RENAME COLUMN monthly_online_seconds TO quarterly_online_seconds;
ALTER TABLE girls_status RENAME COLUMN monthly_anchor TO quarterly_anchor;
ALTER TABLE girls_status RENAME COLUMN weekly_online_seconds TO monthly_online_seconds;
ALTER TABLE girls_status RENAME COLUMN weekly_anchor TO monthly_anchor;

-- 重建索引
DROP INDEX IF EXISTS idx_girls_status_weekly_anchor;
DROP INDEX IF EXISTS idx_girls_status_monthly_anchor;

CREATE INDEX idx_girls_status_monthly_anchor 
  ON girls_status(monthly_anchor) WHERE monthly_anchor IS NOT NULL;
  
CREATE INDEX idx_girls_status_quarterly_anchor 
  ON girls_status(quarterly_anchor) WHERE quarterly_anchor IS NOT NULL;

COMMIT;

-- 然后恢复旧的 RPC 函数（从备份）
```

## 注意事项

1. **数据迁移**：字段重命名后，原来的"月统计"数据会变成"7天统计"，原来的"季度统计"会变成"月统计"。如果需要清空重新计算，在 `rename_online_stats_fields.sql` 中取消注释重置语句。

2. **7天统计逻辑**：新的 7天统计使用 `weekly_anchor` 记录最后一次统计的日期，如果当前日期距离 `weekly_anchor` 超过 7 天，则会重置统计。

3. **兼容性**：确保前后端同时部署，避免版本不一致导致的错误。

4. **测试环境**：建议先在测试环境执行完整流程，确认无误后再在生产环境执行。

## 执行清单

- [ ] 1. 备份 girls_status 表数据
- [ ] 2. 在测试环境执行 `rename_online_stats_fields.sql`
- [ ] 3. 在测试环境执行 `update_rpcs_for_7day_stats.sql`
- [ ] 4. 验证测试环境数据和功能
- [ ] 5. 部署前端代码到测试环境
- [ ] 6. 测试 Me 页面显示是否正确
- [ ] 7. 在生产环境执行 SQL 脚本
- [ ] 8. 部署前端代码到生产环境
- [ ] 9. 验证生产环境功能
- [ ] 10. 监控错误日志

## 相关文件

- `docs/sql/rename_online_stats_fields.sql` - 字段重命名脚本
- `docs/sql/update_rpcs_for_7day_stats.sql` - RPC 函数更新脚本
- `docs/DB.md` - 更新后的数据库文档
- `docs/sql/me_rpcs.sql` - 更新后的 RPC 文档
- `docs/sql/girl_status_setup.sql` - 更新后的安装脚本

## 技术支持

如有问题，请查看：
1. Supabase Dashboard > Database > Logs
2. 前端 Console 错误日志
3. 数据库字段和索引状态

