/**
 * CBODY 管理类型定义
 */

export interface CbodyGirl {
  id: string
  girl_number: string
  name: string
  avatar_url: string | null
  status: 'available' | 'busy'
  next_available_time: string | null
}

export interface UpdateStatusData {
  girl_id: string
  minutes: number
}
