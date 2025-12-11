# CBODY Girls API 部署指南

## 功能概述

提供技师列表 API 接口,供合作方调用。

**访问地址**: `https://api.cbody.vip/api/v1/girls`

**安全机制**:
- API Key 认证
- 限流保护(100次/分钟, 1000次/小时)
- 数据脱敏(只返回必要字段)
- 域名隔离(api.cbody.vip 根路径404)

---

## 部署步骤

### 1. 创建数据库表

在 Supabase SQL Editor 中执行:

```bash
supabase/migrations/add_api_keys_table.sql
```

或直接执行:
```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 100,
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON api_keys FOR ALL USING (false);
```

### 2. 配置域名(Vercel)

**添加自定义域名**:
1. 进入 Vercel 项目设置 → Domains
2. 添加 `api.cbody.vip`
3. 在 DNS 服务商添加 CNAME 记录:
   ```
   api.cbody.vip → cname.vercel-dns.com
   ```
4. 等待 SSL 证书生效

### 3. 生成 API Key

运行脚本生成 API Key:

```bash
node scripts/generate-api-key.js "Partner Name"
```

**输出示例**:
```
🔑 API Key 生成成功!
合作方名称: Partner Name

📋 API Key (请提供给合作方):
cbody_Xy7sK9mPqR3vN8wL2jT6hF4bC1aG5dE0

📝 请在 Supabase SQL Editor 中执行以下 SQL:
INSERT INTO api_keys (partner_name, api_key_hash, is_active, ...)
VALUES (...);
```

复制 SQL 到 Supabase 执行。

### 4. 部署代码

```bash
git add .
git commit -m "Add Girls API"
git push
```

Vercel 自动部署。

### 5. 验证接口

**测试无 API Key (应返回 401)**:
```bash
curl https://api.cbody.vip/api/v1/girls
```

**测试有效 API Key (应返回数据)**:
```bash
curl -H "Authorization: Bearer cbody_Xy7s..." https://api.cbody.vip/api/v1/girls
```

**测试根路径 (应返回 404)**:
```bash
curl https://api.cbody.vip/
```

**查看文档**:
```bash
curl https://api.cbody.vip/api/v1/docs
```

---

## API 使用说明

### 认证方式

**方式1: Authorization Header (推荐)**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.cbody.vip/api/v1/girls
```

**方式2: Query Parameter**
```bash
curl "https://api.cbody.vip/api/v1/girls?api_key=YOUR_API_KEY"
```

### 响应示例

```json
{
  "ok": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "girl_number": 101,
      "city_id": "bangkok",
      "username": "Alice",
      "avatar_url": "https://example.com/avatar.jpg",
      "lat": 13.7563,
      "lng": 100.5018,
      "status": "available",
      "next_available_time": null
    }
  ],
  "meta": {
    "total": 1,
    "timestamp": "2024-12-09T10:00:00Z"
  }
}
```

### 限流响应

超出限流时返回:
```json
{
  "ok": false,
  "error": "Rate limit exceeded",
  "retryAfter": 30
}
```

HTTP 状态码: `429 Too Many Requests`

---

## 管理操作

### 禁用 API Key

```sql
UPDATE api_keys
SET is_active = false
WHERE partner_name = 'Partner Name';
```

### 调整限流

```sql
UPDATE api_keys
SET rate_limit_per_minute = 200,
    rate_limit_per_hour = 5000
WHERE partner_name = 'Partner Name';
```

### 查看使用统计

```sql
SELECT
  ak.partner_name,
  COUNT(*) as request_count,
  MAX(arl.created_at) as last_request
FROM api_request_logs arl
JOIN api_keys ak ON ak.id = arl.api_key_id
WHERE arl.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY ak.partner_name
ORDER BY request_count DESC;
```

### 查看错误请求

```sql
SELECT
  ak.partner_name,
  arl.endpoint,
  arl.response_status,
  arl.created_at
FROM api_request_logs arl
JOIN api_keys ak ON ak.id = arl.api_key_id
WHERE arl.response_status >= 400
ORDER BY arl.created_at DESC
LIMIT 100;
```

---

## 安全注意事项

✅ **已实现的安全措施**:
- API Key SHA-256 Hash 存储(不存明文)
- 限流保护(分钟+小时双重限制)
- IP 限流(1000次/小时)
- 数据脱敏(只返回公开字段)
- 域名隔离(api.cbody.vip 只响应 /api/*)
- RLS 策略(api_keys 表禁止外部访问)

❌ **不要**:
- 不要在客户端代码中暴露 API Key
- 不要通过明文邮件发送 API Key
- 不要共享 API Key 给多个合作方

---

## 故障排查

### 问题: 返回 401 Unauthorized

**原因**:
- API Key 错误
- API Key 未激活 (is_active = false)
- API Key 未插入数据库

**解决**: 检查 Supabase `api_keys` 表,确认 Key 存在且激活。

### 问题: 返回 429 Too Many Requests

**原因**: 超出限流

**解决**:
- 等待 `retryAfter` 秒后重试
- 或调整该 API Key 的限流配置

### 问题: api.cbody.vip 无法访问

**原因**: DNS 未生效或 Vercel 域名未配置

**解决**:
- 检查 DNS CNAME 记录
- 检查 Vercel 项目域名配置
- 等待 DNS 传播(最多24小时)

---

## 监控建议

1. **定期检查使用量**:
   ```sql
   SELECT COUNT(*), DATE(created_at)
   FROM api_request_logs
   GROUP BY DATE(created_at)
   ORDER BY DATE(created_at) DESC;
   ```

2. **监控错误率**:
   ```sql
   SELECT
     response_status,
     COUNT(*) as count
   FROM api_request_logs
   WHERE created_at >= NOW() - INTERVAL '1 hour'
   GROUP BY response_status;
   ```

3. **设置告警**: 可使用 Supabase Webhooks 在错误率过高时发送通知

---

**文档版本**: 1.0
**最后更新**: 2024-12-09
