/**
 * Aloha 管理类型定义
 */

export type GirlStatus = 'available' | 'busy' | 'offline'

export interface AlohaGirl {
  id: string
  girl_number: string
  name: string
  avatar_url: string | null
  status: GirlStatus
  next_available_time: string | null
}

export interface UpdateStatusData {
  girl_id: string
  minutes: number // 忙碌时长（分钟）
}
