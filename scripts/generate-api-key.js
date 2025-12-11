/**
 * API Key 生成脚本
 *
 * 使用方法:
 * 1. 运行: node scripts/generate-api-key.js <partner_name>
 * 2. 将生成的 API Key 提供给合作方
 * 3. 将 SQL 插入语句在 Supabase SQL Editor 中执行
 *
 * 示例: node scripts/generate-api-key.js "Partner ABC"
 */

const crypto = require('crypto')

// 生成随机 API Key
function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'cbody_'
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 生成 Hash
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}

// 主函数
function main() {
  const partnerName = process.argv[2]

  if (!partnerName) {
    console.error('错误: 请提供合作方名称')
    console.log('使用方法: node scripts/generate-api-key.js <partner_name>')
    console.log('示例: node scripts/generate-api-key.js "Partner ABC"')
    process.exit(1)
  }

  const apiKey = generateApiKey()
  const apiKeyHash = hashApiKey(apiKey)

  console.log('\n========================================')
  console.log('🔑 API Key 生成成功!')
  console.log('========================================\n')

  console.log('合作方名称:', partnerName)
  console.log('\n📋 API Key (请提供给合作方):')
  console.log('----------------------------------------')
  console.log(apiKey)
  console.log('----------------------------------------\n')

  console.log('⚠️  重要提示:')
  console.log('- 请妥善保管此 API Key,仅展示一次')
  console.log('- 请通过安全渠道(加密邮件/私聊)发送给合作方')
  console.log('- 系统中只存储 Hash,无法恢复原始 Key\n')

  console.log('📝 请在 Supabase SQL Editor 中执行以下 SQL:')
  console.log('----------------------------------------')
  console.log(`INSERT INTO api_keys (partner_name, api_key_hash, is_active, rate_limit_per_minute, rate_limit_per_hour, notes)
VALUES (
  '${partnerName}',
  '${apiKeyHash}',
  true,
  100,
  1000,
  'Generated on ${new Date().toISOString()}'
);`)
  console.log('----------------------------------------\n')

  console.log('✅ 完成后,合作方可使用以下方式调用 API:')
  console.log(`curl -H "Authorization: Bearer ${apiKey}" https://api.cbody.vip/api/v1/girls`)
  console.log('\n========================================\n')
}

main()
