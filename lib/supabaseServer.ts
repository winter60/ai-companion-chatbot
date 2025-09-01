import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

// Create a Supabase client with service role key for server-side operations
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// For server-side with user context (using anon key with auth)
export const createSupabaseServerClient = (accessToken?: string) => {
  if (accessToken) {
    return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    })
  }
  
  // Use service role for unauthenticated operations
  return supabaseServer
}