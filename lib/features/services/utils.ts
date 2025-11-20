import type { Service, ServiceBadge, MultiLanguageText } from './types'

/**
 * 获取分类名称(优先使用中文)
 */
export function getCategoryName(category: { code: string; name: MultiLanguageText }): string {
  return category.name.zh || category.name.en || category.name.th || category.code
}

/**
 * 获取服务标题(优先使用中文)
 */
export function getServiceTitle(service: Service): string {
  return service.title.zh || service.title.en || service.title.th || service.code
}

/**
 * 获取徽章变体
 */
export function getBadgeVariant(badge: string | null): 'destructive' | 'default' | 'secondary' | 'outline' {
  switch (badge) {
    case 'HOT':
      return 'destructive'
    case 'NEW':
      return 'default'
    case 'TOP_PICK':
      return 'secondary'
    default:
      return 'outline'
  }
}

/**
 * 获取徽章文本
 */
export function getBadgeText(badge: string | null): string {
  switch (badge) {
    case 'HOT':
      return '热门'
    case 'NEW':
      return '新品'
    case 'TOP_PICK':
      return '精选'
    default:
      return badge || ''
  }
}
