export type AdminRole = 'superadmin' | 'admin' | 'finance' | 'support'

export interface AdminProfile {
  id: string
  display_name: string
  role: AdminRole
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface AdminOperationLog {
  id: string
  operator_id: string
  target_admin_id: string
  operation_type: string
  operation_details?: Record<string, any>
  created_at: string
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      admin_profiles: {
        Row: AdminProfile
        Insert: {
          id: string
          display_name: string
          role: AdminRole
          is_active?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          display_name?: string
          role?: AdminRole
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
      }
      admin_operation_logs: {
        Row: AdminOperationLog
        Insert: {
          operator_id: string
          target_admin_id: string
          operation_type: string
          operation_details?: Json | null
        }
        Update: {
          operator_id?: string
          target_admin_id?: string
          operation_type?: string
          operation_details?: Json | null
        }
      }
    }
  }
}