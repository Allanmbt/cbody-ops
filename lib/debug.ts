import { getSupabaseClient } from "./supabase"

export async function debugAuth() {
  const supabase = getSupabaseClient()

  console.log('=== Auth Debug Info ===')

  // Check current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  console.log('Current session:', session)
  console.log('Session error:', sessionError)

  // Check current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.log('Current user:', user)
  console.log('User error:', userError)

  if (user) {
    console.log('User ID:', user.id)
    console.log('User email:', user.email)

    // Check admin_profiles table structure
    console.log('=== Checking admin_profiles table ===')
    const { data: profiles, error: profilesError } = await supabase
      .from('admin_profiles')
      .select('*')
      .limit(10)

    console.log('Admin profiles query result:', profiles)
    console.log('Admin profiles error:', profilesError)

    // Check specifically for current user
    const { data: userProfile, error: userProfileError } = await supabase
      .from('admin_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    console.log('Current user profile:', userProfile)
    console.log('Current user profile error:', userProfileError)
  }

  console.log('=== End Debug Info ===')
}