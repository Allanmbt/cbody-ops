'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { AdminProfile } from '@/lib/types/admin'

export function useCurrentAdmin() {
    const [admin, setAdmin] = useState<AdminProfile | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const supabase = createClientComponentClient()

        const getAdmin = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()

                if (!user) {
                    setAdmin(null)
                    setLoading(false)
                    return
                }

                const { data: adminProfile, error } = await supabase
                    .from('admin_profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single()

                if (error || !adminProfile) {
                    setAdmin(null)
                } else {
                    setAdmin(adminProfile as AdminProfile)
                }
            } catch (error) {
                console.error('Error fetching admin profile:', error)
                setAdmin(null)
            } finally {
                setLoading(false)
            }
        }

        getAdmin()

        // 监听认证状态变化
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === 'SIGNED_OUT' || !session) {
                    setAdmin(null)
                    setLoading(false)
                } else if (event === 'SIGNED_IN') {
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
