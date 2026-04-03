import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getTokensFromCode } from '@/lib/google'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/dashboard?error=google_auth_failed', req.url))
  }

  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const tokens = await getTokensFromCode(code)

    await supabase
      .from('profiles')
      .update({
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_token_expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        gmail_sync_enabled: true,
        calendar_sync_enabled: true,
      })
      .eq('id', session.user.id)

    return NextResponse.redirect(new URL('/dashboard?success=google_connected', req.url))
  } catch (err) {
    console.error('Google OAuth error:', err)
    return NextResponse.redirect(new URL('/dashboard?error=google_token_failed', req.url))
  }
}
