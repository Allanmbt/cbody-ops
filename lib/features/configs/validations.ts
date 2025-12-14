import { z } from "zod"

// 车费计价配置验证模式
export const fareParamsSchema = z.object({
  // 主计价参数
  baseFare: z.number().min(0, "基础费用不能为负数"),
  freeDistanceKm: z.number().min(0, "免费距离不能为负数"),
  tier1PerKm: z.number().min(0, "第一档单价不能为负数"),
  tier2PerKm: z.number().min(0, "第二档单价不能为负数"),
  tier3PerKm: z.number().min(0, "第三档单价不能为负数"),
  perMin: z.number().min(0, "时间费用不能为负数"),
  tripMultiplier: z.number().min(1, "行程倍数至少为1").max(3, "行程倍数不能超过3"),
  minFare: z.number().min(0, "最低收费不能为负数"),
  roundUpTo: z.number().min(1, "向上取整倍数至少为1"),

  // 环境参数
  rain_enabled: z.boolean(),
  rain_multiplier: z.number().min(1, "雨天倍数不能小于1").max(2, "雨天倍数不能超过2"),
  congestion_enabled: z.boolean(),
  congestion_multiplier: z.number().min(1, "拥堵倍数不能小于1").max(2, "拥堵倍数不能超过2"),

  // ETA 缓冲
  eta_buffer_min_base: z.number().min(0, "默认缓冲时间不能为负数"),
  eta_buffer_min_rain: z.number().min(0, "雨天缓冲时间不能为负数"),
  eta_buffer_min_congestion: z.number().min(0, "拥堵缓冲时间不能为负数"),
})

// 配置更新验证模式
export const updateConfigSchema = z.object({
  id: z.string().uuid("无效的配置ID"),
  value_json: z.record(z.string(), z.any()).optional(),
  value_text: z.string().optional(),
  value_url: z.string().url("无效的URL格式").optional(),
  description: z.string().optional(),
})

// 银行卡账户验证模式
export const bankAccountSchema = z.object({
  id: z.string().min(1, "银行账户ID不能为空"),
  code: z.string().min(1, "银行代码不能为空"),
  bank_name: z.string().min(1, "银行名称不能为空"),
  account_holder: z.string().min(1, "账户持有人不能为空"),
  account_number: z.string().min(1, "账号不能为空"),
  qr_code_url: z.string().url("无效的二维码URL"),
  is_active: z.boolean(),
  sort_order: z.number().int().min(1, "排序必须为正整数"),
})

// 银行卡配置验证模式
export const bankAccountsConfigSchema = z.object({
  accounts: z.array(bankAccountSchema),
})
