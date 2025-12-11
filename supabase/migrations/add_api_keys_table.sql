-- API密钥管理表
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

-- 索引
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

-- API请求日志表(可选,用于监控)
CREATE TABLE IF NOT EXISTS api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id),
  endpoint TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  response_status INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_api_logs_key ON api_request_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_request_logs(created_at);

-- RLS策略(禁用外部访问)
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

-- 只允许服务端访问
CREATE POLICY "Service role only" ON api_keys FOR ALL USING (false);
CREATE POLICY "Service role only" ON api_request_logs FOR ALL USING (false);

COMMENT ON TABLE api_keys IS 'API密钥管理';
COMMENT ON TABLE api_request_logs IS 'API请求日志';
