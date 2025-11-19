import type { Order, OrderStatus, MultiLangText } from './types'

/**
 * 获取订单状态文本
 */
export function getOrderStatusText(status: OrderStatus): string {
  const statusMap: Record<OrderStatus, string> = {
    pending: '待确认',
    confirmed: '已确认',
    en_route: '在路上',
    arrived: '已到达',
    in_service: '服务中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return statusMap[status] || status
}

/**
 * 获取订单状态变体（Badge 样式）
 */
export function getOrderStatusVariant(status: OrderStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed':
      return 'default'
    case 'in_service':
    case 'arrived':
    case 'en_route':
    case 'confirmed':
      return 'secondary'
    case 'cancelled':
      return 'destructive'
    default:
      return 'outline'
  }
}

/**
 * 获取技师显示名称
 */
export function getGirlName(girl: Order['girl']): string {
  if (!girl) return '未知技师'
  return girl.name || `#${girl.girl_number}`
}

/**
 * 获取服务名称（优先中文）
 */
export function getServiceTitle(service: Order['service'] | MultiLangText): string {
  if (!service) return '未知服务'
  if ('title' in service) {
    return service.title.zh || service.title.en || service.title.th || ''
  }
  return service.zh || service.en || service.th || ''
}

/**
 * 格式化金额（泰铢）
 * 说明：数据库金额为 DECIMAL(10,2)，这里统一按整数泰铢展示，去掉尾部小数 .00
 */
export function formatCurrency(amount: number | string): string {
  const numeric = typeof amount === 'number' ? amount : Number(amount || 0)
  const rounded = Math.round(numeric)
  return `₿${rounded.toLocaleString()}`
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`

  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
