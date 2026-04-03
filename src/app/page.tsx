import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  redirect('/dashboard')
}
