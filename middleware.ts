import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This middleware refreshes the Supabase auth session on every request.
//
// Why this file is required: Next.js App Router Server Components and
// Route Handlers cannot write cookies themselves. If the session's access
// token expires between requests, nothing automatically refreshes it —
// the browser client can show a logged-in user while server-rendered
// pages and API routes see no session at all (or a stale/expired one).
// This was almost certainly the cause of the original "stuck after
// Google consent screen" bug on Vercel: the OAuth code exchange could
// succeed, but subsequent server-side requests had no mechanism to keep
// the session cookie fresh.
//
// createMiddlewareClient reads the request cookies, refreshes the
// session if needed, and writes the updated cookies onto the response —
// keeping client and server in sync on every request.
export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Touching getSession() here is what triggers the refresh-and-rewrite
  // of the auth cookies onto `res` when the access token is stale.
  await supabase.auth.getSession()

  return res
}

// Run on every route except static assets and image optimization files,
// so the session stays fresh everywhere — pages, layouts, and API routes.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}