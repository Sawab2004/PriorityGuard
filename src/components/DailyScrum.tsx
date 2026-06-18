'use client'

import { useState, useEffect } from 'react'
import { X, Sparkles, Trophy, Target, Clock, Loader2 } from 'lucide-react'
import { Profile } from '@/types'
import { cn } from '@/lib/utils'

interface DailyScrumProps {
  profile: Profile | null
  onClose: () => void
}

export default function DailyScrum({ profile, onClose }: DailyScrumProps) {
  const [briefing, setBriefing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!profile) return

    const lastBriefing = profile.last_briefing_at
    const today = new Date().toISOString().split('T')[0]
    const hasBriefedToday = lastBriefing && lastBriefing.split('T')[0] === today

    if (!hasBriefedToday) {
      fetchBriefing()
    }
  }, [profile])

  const fetchBriefing = async () => {
    setLoading(true)
    setShow(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/scrum')
      const data = await res.json()
      if (data.briefing) {
        setBriefing(data.briefing)
      } else if (data.error) {
        setError(data.error)
      }
    } catch (err: any) {
      console.error(err)
      setError("Connection failed. Check your network.")
    } finally {
      setLoading(false)
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-md animate-fade-in">
      <div className="bg-cream w-full max-w-lg rounded-3xl shadow-2xl border border-white/20 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="relative h-32 bg-ink flex items-center justify-center overflow-hidden">
           <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
           <div className="relative z-10 text-center">
             <Trophy className="text-amber mx-auto mb-2" size={32} />
             <h2 className="text-cream font-display text-xl font-bold tracking-tight">Your Daily Strategy</h2>
             <p className="text-sage text-xs font-medium uppercase tracking-widest mt-1">Chief of Staff Briefing</p>
           </div>
           <button 
             onClick={() => { setShow(false); onClose(); }}
             className="absolute top-4 right-4 text-cream/40 hover:text-cream transition-colors"
           >
             <X size={24} />
           </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="text-sage animate-spin" size={32} />
              <p className="text-mist font-body text-sm italic">Analyzing your high-impact backlog...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                 <div className="w-10 h-10 rounded-2xl bg-amber/10 flex items-center justify-center text-amber flex-shrink-0">
                    <Sparkles size={20} />
                 </div>
                 <div>
                    <h3 className="font-display font-bold text-ink mb-2">
                      {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'Focus Pro'}
                    </h3>
                    <div className={cn(
                      "text-sm font-body leading-relaxed whitespace-pre-wrap",
                      error ? "text-rust font-medium" : "text-ink/80"
                    )}>
                      {briefing || error || "Couldn't load your briefing right now."}
                    </div>
                    {error && (
                      <button
                        onClick={fetchBriefing}
                        className="mt-3 text-xs font-body font-medium text-sage hover:text-sage-dark underline underline-offset-2"
                      >
                        Try again
                      </button>
                    )}
                 </div>
              </div>

              <div className="pt-6 border-t border-ink/5">
                <button 
                  onClick={() => { setShow(false); onClose(); }}
                  disabled={!briefing && !!error}
                  className="w-full btn-primary py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-sage/10 text-base disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Target size={20} />
                  {briefing ? 'Accept Strategy & Begin' : 'Dismiss'}
                </button>
                {briefing && (
                  <p className="text-[10px] text-mist/60 text-center mt-4 uppercase font-bold tracking-widest">
                     Peak focus window starts in 12 minutes
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}