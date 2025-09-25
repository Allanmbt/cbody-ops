import { getSupabaseClient, getSupabaseAdminClient } from "./supabase"
import type { AdminRole } from "./types"

export async function createAdminUser(email: string, password: string, displayName: string, role: AdminRole = 'superadmin') {
  try {
    const supabaseAdmin = getSupabaseAdminClient()

    // Create the user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) {
      console.error('Failed to create auth user:', authError)
      return { success: false, error: authError.message }
    }

    if (!authData.user) {
      return { success: false, error: 'No user created' }
    }

    console.log('Auth user created:', authData.user.id)

    // Create the admin profile
    const supabase = getSupabaseClient()
    const { data: profileData, error: profileError } = await supabase
      .from('admin_profiles')
      .insert({
        id: authData.user.id,
        display_name: displayName,
        role: role,
        is_active: true,
        created_by: null,
        updated_by: null
      } as any)
      .select()
      .single()

    if (profileError) {
      console.error('Failed to create admin profile:', profileError)

      // Try to delete the auth user if profile creation failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)

      return { success: false, error: profileError.message }
    }

    console.log('Admin profile created:', profileData)

    return {
      success: true,
      user: authData.user,
      profile: profileData
    }

  } catch (error) {
    console.error('Error creating admin user:', error)
    return { success: false, error: (error as Error).message }
  }
}

export async function syncAdminProfile(userId: string, displayName: string, role: AdminRole = 'superadmin') {
  try {
    const supabase = getSupabaseClient()

    // Check if profile already exists
    const { data: existing } = await supabase
      .from('admin_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (existing) {
      console.log('Admin profile already exists:', existing)
      return { success: true, profile: existing }
    }

    // Create the admin profile
    const { data: profileData, error: profileError } = await supabase
      .from('admin_profiles')
      .insert({
        id: userId,
        display_name: displayName,
        role: role,
        is_active: true,
        created_by: null,
        updated_by: null
      } as any)
      .select()
      .single()

    if (profileError) {
      console.error('Failed to create admin profile:', profileError)
      return { success: false, error: profileError.message }
    }

    console.log('Admin profile created:', profileData)
    return { success: true, profile: profileData }

  } catch (error) {
    console.error('Error syncing admin profile:', error)
    return { success: false, error: (error as Error).message }
  }
}