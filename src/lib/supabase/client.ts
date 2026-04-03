import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Browser client (for use in Client Components)
export const createBrowserClient = () =>
  createClientComponentClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  })
