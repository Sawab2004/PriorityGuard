'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  const handleGoogleLogin = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
  }

  return (
    <div className="min-h-screen bg-cream grain flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-amber/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-sage/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-ink rounded-2xl mb-6 shadow-lg">
            <span className="text-2xl">🛡</span>
          </div>
          <h1 className="font-display text-4xl font-bold text-ink mb-3">
            PriorityGuard
          </h1>
          <p className="font-body text-mist text-base leading-relaxed max-w-xs mx-auto">
            Your AI chief of staff. Protect your peak hours from low-value work.
          </p>
        </div>

        {/* Login card */}
        <div className="card text-center space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink mb-1">
              Start protecting your time
            </h2>
            <p className="text-sm text-mist font-body">
              Sign in to manage your priorities
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-ink/12
              hover:border-ink/25 rounded-xl px-5 py-3.5 font-body font-medium text-sm text-ink
              shadow-sm hover:shadow-md transition-all duration-200 active:scale-98 disabled:opacity-60"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          <p className="text-xs text-mist font-body">
            Your task data is private and encrypted.
            <br />We never sell your data.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { icon: '🧠', label: 'AI Scoring' },
            { icon: '📧', label: 'Gmail Sync' },
            { icon: '📅', label: 'Calendar' },
          ].map(f => (
            <div key={f.label} className="text-center p-3 rounded-xl bg-white/40 border border-ink/6">
              <div className="text-xl mb-1">{f.icon}</div>
              <div className="text-xs font-body text-mist">{f.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
