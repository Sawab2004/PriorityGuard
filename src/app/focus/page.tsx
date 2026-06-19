'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Task } from '@/types'
import { getScoreColor, getScoreBg, getScoreLabel, formatDuration, formatDueDate, cn } from '@/lib/utils'
import { CheckCircle, SkipForward, ArrowLeft, Clock } from 'lucide-react'

export default function FocusPage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [tasks, setTasks] = useState<Task[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sessionStart] = useState(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Tick timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStart) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [sessionStart])

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    async function fetchTasks() {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      // Focus Mode shows ALL pending tasks, regardless of scheduled
      // date, ranked highest-score first. This replaces the previous
      // ai_score >= 60 cutoff — a freelancer should be able to clear
      // medium- and low-priority work in Focus Mode too, just always
      // in priority order so high-leverage tasks never get buried.
      //
      // nullsFirst: false matches the same convention GET /api/tasks
      // uses, so an unscored task sinks to the bottom of the queue
      // instead of jumping ahead of everything (Postgres defaults to
      // NULLS FIRST on a descending sort otherwise). created_at is a
      // secondary sort so tasks with equal/no score still land in a
      // stable, predictable order.
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'pending')
        .order('ai_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to load focus tasks:', error)
        setTasks([])
        setLoading(false)
        return
      }

      setTasks(data || [])
      setLoading(false)
    }

    fetchTasks()
  }, [router, supabase])

  const currentTask = tasks[currentIndex]

  const handleComplete = async () => {
    if (!currentTask) return
    setActionLoading('complete')

    const completedAt = new Date().toISOString()
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: completedAt })
      .eq('id', currentTask.id)

    if (error) console.error(error)

    setActionLoading(null)
    if (currentIndex + 1 >= tasks.length) {
      setDone(true)
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  const handleSkip = async () => {
    if (!currentTask) return
    setActionLoading('skip')

    const { error } = await supabase
      .from('tasks')
      .update({ status: 'skipped' })
      .eq('id', currentTask.id)

    if (error) console.error(error)

    setActionLoading(null)
    if (currentIndex + 1 >= tasks.length) {
      setDone(true)
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
      </div>
    )
  }

  if (done || tasks.length === 0) {
    return (
      <div className="min-h-screen bg-ink flex flex-col items-center justify-center p-8 text-center">
        <div className="text-5xl mb-6">🎯</div>
        <h1 className="font-display text-3xl font-bold text-cream mb-3">
          {tasks.length === 0 ? 'No pending tasks' : 'Queue complete!'}
        </h1>
        <p className="font-body text-cream/50 text-sm mb-8 max-w-xs">
          {tasks.length === 0
            ? `You're all caught up — nothing pending right now. Add a task on the dashboard to start a focus session.`
            : `Focus session: ${formatElapsed(elapsed)}. You worked through your entire queue.`}
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="bg-amber text-ink font-body font-medium px-6 py-3 rounded-xl hover:bg-amber-light
            transition-colors active:scale-95"
        >
          ← Back to Dashboard
        </button>
      </div>
    )
  }

  const score = currentTask.ai_score
  const scoreColor = getScoreColor(score)
  const progress = ((currentIndex + 1) / tasks.length) * 100

  return (
    <div className="min-h-screen bg-ink flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-cream/8">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-cream/40 hover:text-cream transition-colors text-sm font-body"
        >
          <ArrowLeft size={14} />
          Exit
        </button>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-cream/40 font-mono text-sm">
            <Clock size={12} />
            {formatElapsed(elapsed)}
          </div>
          <div className="text-cream/40 font-body text-sm">
            {currentIndex + 1} / {tasks.length}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-cream/8">
        <div
          className="h-full bg-amber transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main focus area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto w-full">
        <div className="w-full animate-fade-in">
          {/* Score */}
          <div className="flex items-center justify-center mb-8">
            <div className={cn(
              'w-20 h-20 rounded-full border-2 flex items-center justify-center',
              'font-mono text-2xl font-bold focus-spotlight',
              scoreColor,
              'border-current'
            )}>
              {score ?? '?'}
            </div>
          </div>

          {/* Task */}
          <div className="text-center mb-6">
            <div className={cn('tag mb-4 mx-auto inline-flex', getScoreBg(score), getScoreColor(score))}>
              ⚡ {getScoreLabel(score)} Priority
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-cream mb-3 leading-tight text-balance">
              {currentTask.title}
            </h1>
            {currentTask.description && (
              <p className="font-body text-cream/50 text-sm leading-relaxed max-w-md mx-auto">
                {currentTask.description}
              </p>
            )}
          </div>

          {/* Revenue Tracker */}
          <div className="flex flex-col items-center justify-center mb-6 bg-sage/5 border border-sage/10 p-4 rounded-2xl w-full max-w-xs mx-auto">
            <div className="text-[10px] font-body text-sage/70 mb-1 tracking-widest uppercase">Revenue Secured</div>
            <div className="font-mono text-4xl text-sage font-light tracking-tight">
              <span className="opacity-50 text-2xl mr-1">$</span>
              {((elapsed / 3600) * (currentTask.hourly_rate_at_creation || 0)).toFixed(2)}
            </div>
            <div className="text-xs text-sage/40 mt-1">based on ${currentTask.hourly_rate_at_creation || 0}/hr rate</div>
          </div>

          {/* Meta */}
          <div className="flex items-center justify-center gap-4 mb-8 flex-wrap">
            {currentTask.due_date && (
              <span className="text-xs font-body text-cream/40 flex items-center gap-1">
                <Clock size={10} />
                {formatDueDate(currentTask.due_date)}
              </span>
            )}
            {currentTask.estimated_duration_mins && (
              <span className="text-xs font-body text-cream/40">
                ~{formatDuration(currentTask.estimated_duration_mins)}
              </span>
            )}
            <span className="text-xs font-body text-cream/40">
              {currentTask.source === 'gmail' ? '📧 Gmail' :
               currentTask.source === 'calendar' ? '📅 Calendar' :
               currentTask.source === 'voice' ? '🎙️ Voice' : '✏️ Manual'}
            </span>
          </div>

          {/* AI reasoning */}
          {currentTask.ai_reasoning && (
            <div className="bg-cream/5 border border-cream/8 rounded-xl p-4 mb-8">
              <p className="text-xs font-body text-cream/50 leading-relaxed text-center">
                <span className="text-amber font-medium">Why now: </span>
                {currentTask.ai_reasoning}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleSkip}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-6 py-3 bg-cream/8 hover:bg-cream/15
                text-cream/60 hover:text-cream rounded-xl font-body font-medium text-sm
                transition-all duration-150 active:scale-95 disabled:opacity-40"
            >
              {actionLoading === 'skip'
                ? <div className="w-4 h-4 border border-cream/20 border-t-cream rounded-full animate-spin" />
                : <SkipForward size={16} />
              }
              Skip
            </button>

            <button
              onClick={handleComplete}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-8 py-3 bg-amber hover:bg-amber-light
                text-ink rounded-xl font-body font-semibold text-sm
                transition-all duration-150 active:scale-95 disabled:opacity-40 shadow-lg shadow-amber/20"
            >
              {actionLoading === 'complete'
                ? <div className="w-4 h-4 border border-ink/20 border-t-ink rounded-full animate-spin" />
                : <CheckCircle size={16} />
              }
              Mark Complete
            </button>
          </div>

          {/* Upcoming task preview */}
          {tasks[currentIndex + 1] && (
            <div className="mt-10 text-center">
              <p className="text-xs font-body text-cream/25 mb-1">Up next</p>
              <p className="text-xs font-body text-cream/40 truncate max-w-xs mx-auto">
                {tasks[currentIndex + 1].title}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}