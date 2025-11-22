import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化货币金额
 * @param amount 金额
 * @param currency 币种，默认 THB
 * @returns 格式化后的货币字符串
 */
export function formatCurrency(amount: number | string, currency: string = 'THB'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(num)) {
    return '0.00 THB'
  }

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num))

  const sign = num < 0 ? '-' : ''

  return `${sign}${formatted} ${currency}`
}
