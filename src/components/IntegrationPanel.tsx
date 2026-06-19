'use client'

import { useState } from 'react'
import { getGoogleAuthUrl } from '@/lib/google'
import { RefreshCw, Mail, Calendar, CheckCircle } from 'lucide-react'

interface IntegrationPanelProps {
  gmailEnabled: boolean
  calendarEnabled: boolean
  onTasksImported: () => void
  session?: any
}

export default function IntegrationPanel({
  gmailEnabled,
  calendarEnabled,
  onTasksImported,
  session,
}: IntegrationPanelProps) {
  const [syncingGmail, setSyncingGmail] = useState(false)
  const [syncingCalendar, setSyncingCalendar] = useState(false)
  const [gmailResult, setGmailResult] = useState<string | null>(null)
  const [calendarResult, setCalendarResult] = useState<string | null>(null)

  const connectGoogle = () => {
    // Redirect to Google OAuth entry point
    window.location.href = '/api/auth/google'
  }

  const syncGmail = async () => {
    setSyncingGmail(true)
    setGmailResult(null)
    try {
      const res = await fetch('/api/gmail', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        // Previously fell through to `data.message` / `data.imported`,
        // both undefined on an error response — which is what produced
        // the literal "Imported undefined tasks" message in the UI.
        setGmailResult(data.error || 'Sync failed. Try again.')
        return
      }

      setGmailResult(data.message || `Imported ${data.imported} tasks`)
      if (data.imported > 0) onTasksImported()
    } catch (err) {
      console.error('Gmail sync error:', err)
      setGmailResult('Could not reach the server. Check your connection and try again.')
    } finally {
      setSyncingGmail(false)
    }
  }

  const syncCalendar = async () => {
    setSyncingCalendar(true)
    setCalendarResult(null)
    try {
      const res = await fetch('/api/calendar', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setCalendarResult(data.error || 'Sync failed. Try again.')
        return
      }

      setCalendarResult(data.message || `Imported ${data.imported} events`)
      if (data.imported > 0) onTasksImported()
    } catch (err) {
      console.error('Calendar sync error:', err)
      setCalendarResult('Could not reach the server. Check your connection and try again.')
    } finally {
      setSyncingCalendar(false)
    }
  }

  const isConnected = gmailEnabled || calendarEnabled

  return (
    <div className="bg-white/50 backdrop-blur-sm border border-ink/8 rounded-2xl p-4 space-y-3">
      <h3 className="font-body text-sm font-semibold text-ink flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber" />
        Integrations
      </h3>

      {!isConnected ? (
        <div className="text-center py-3">
          <p className="text-xs text-mist font-body mb-3">
            {!session 
              ? 'Sign in to connect Gmail & Calendar' 
              : 'Connect Google to pull tasks from Gmail & Calendar'}
          </p>
          <button
            onClick={!session ? () => window.location.href = '/login' : connectGoogle}
            className="btn-secondary text-xs flex items-center gap-2 mx-auto"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {!session ? 'Sign in with Google' : 'Connect Google Account'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Gmail */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail size={14} className={gmailEnabled ? 'text-sage' : 'text-mist'} />
                <span className="text-xs font-body text-ink">Gmail</span>
                {gmailEnabled && <CheckCircle size={10} className="text-sage" />}
              </div>
              {gmailEnabled ? (
                <button
                  onClick={syncGmail}
                  disabled={syncingGmail}
                  className="flex items-center gap-1 text-xs font-body text-amber hover:text-amber-dark
                    disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={11} className={syncingGmail ? 'animate-spin' : ''} />
                  {syncingGmail ? 'Syncing…' : 'Sync now'}
                </button>
              ) : (
                <span className="text-xs text-mist">Not connected</span>
              )}
            </div>
            {gmailResult && <p className="text-xs text-mist font-body ml-5">{gmailResult}</p>}
          </div>

          {/* Calendar */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={14} className={calendarEnabled ? 'text-sage' : 'text-mist'} />
                <span className="text-xs font-body text-ink">Calendar</span>
                {calendarEnabled && <CheckCircle size={10} className="text-sage" />}
              </div>
              {calendarEnabled ? (
                <button
                  onClick={syncCalendar}
                  disabled={syncingCalendar}
                  className="flex items-center gap-1 text-xs font-body text-amber hover:text-amber-dark
                    disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={11} className={syncingCalendar ? 'animate-spin' : ''} />
                  {syncingCalendar ? 'Syncing…' : 'Sync now'}
                </button>
              ) : (
                <span className="text-xs text-mist">Not connected</span>
              )}
            </div>
            {calendarResult && <p className="text-xs text-mist font-body ml-5">{calendarResult}</p>}
          </div>
          
          <div className="border-t border-ink/10 pt-3 space-y-3">
             <div className="text-[10px] uppercase font-bold text-mist/60 tracking-wider">Zero-Admin Integrations</div>

             {/* Notion — not yet built */}
             <div className="flex flex-col gap-1">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2 text-ink/50">
                    <span className="text-sm grayscale opacity-60">📓</span>
                    <span className="text-xs font-body font-medium">Notion Tasks</span>
                 </div>
                 <span className="text-[10px] font-body font-semibold uppercase tracking-wide bg-mist/10 text-mist px-2 py-1 rounded">
                   Coming soon
                 </span>
               </div>
             </div>

             {/* Todoist — not yet built */}
             <div className="flex flex-col gap-1">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2 text-ink/50">
                    <span className="text-sm grayscale opacity-60">✅</span>
                    <span className="text-xs font-body font-medium">Todoist</span>
                 </div>
                 <span className="text-[10px] font-body font-semibold uppercase tracking-wide bg-mist/10 text-mist px-2 py-1 rounded">
                   Coming soon
                 </span>
               </div>
             </div>

             {/* ClickUp — not yet built */}
             <div className="flex flex-col gap-1">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2 text-ink/50">
                    <span className="text-sm grayscale opacity-60">🟣</span>
                    <span className="text-xs font-body font-medium">ClickUp</span>
                 </div>
                 <span className="text-[10px] font-body font-semibold uppercase tracking-wide bg-mist/10 text-mist px-2 py-1 rounded">
                   Coming soon
                 </span>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}