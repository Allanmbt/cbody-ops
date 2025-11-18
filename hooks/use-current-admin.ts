'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import type { AdminProfile } from '@/lib/types/admin'

export function useCurrentAdmin() {
    const [admin, setAdmin] = useState<AdminProfile | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const supabase = getSupabaseClient()

        const getAdmin = async () => {
            try {
                console.log('[useCurrentAdmin] Getting current user...')
                const { data: { user }, error: userError } = await supabase.auth.getUser()

                if (userError) {
                    console.error('[useCurrentAdmin] Error getting user:', userError)
                    setAdmin(null)
                    setLoading(false)
                    return
                }

                if (!user) {
                    console.log('[useCurrentAdmin] No user found')
                    setAdmin(null)
                    setLoading(false)
                    return
                }

                console.log('[useCurrentAdmin] User found:', user.id)

                // 查询管理员资料
                const { data: adminProfile, error } = await supabase
                    .from('admin_profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single()

                if (error) {
                    console.error('[useCurrentAdmin] Error fetching admin profile:', error)
                    console.error('[useCurrentAdmin] Error code:', error.code)
                    console.error('[useCurrentAdmin] Error details:', error.details)
                    console.error('[useCurrentAdmin] Error hint:', error.hint)
                    setAdmin(null)
                } else if (!adminProfile) {
                    console.log('[useCurrentAdmin] No admin profile found for user:', user.id)
                    setAdmin(null)
                } else {
                    const profile = adminProfile as unknown as AdminProfile
                    console.log('[useCurrentAdmin] Admin profile found:', profile.id, profile.role)
                    setAdmin(profile)
                }
            } catch (error) {
                console.error('[useCurrentAdmin] Unexpected error:', error)
                setAdmin(null)
            } finally {
                setLoading(false)
            }
        }

        getAdmin()

        // 监听认证状态变化
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                console.log('[useCurrentAdmin] Auth state changed:', event)
                if (event === 'SIGNED_OUT' || !session) {
                    setAdmin(null)
                    setLoading(false)
                } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    getAdmin()
                }
            }
        )

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    return { admin, loading }
}
