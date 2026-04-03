'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Task, Profile } from '@/types'
import TaskCard from '@/components/TaskCard'
import AddTaskForm from '@/components/AddTaskForm'
import StatsBar from '@/components/StatsBar'
import IntegrationPanel from '@/components/IntegrationPanel'
import ThemeToggle from '@/components/ThemeToggle'
import RevenueAudit from '@/components/RevenueAudit'
import ChatCoach from '@/components/ChatCoach'
import { LogOut, Zap, User } from 'lucide-react'
import { cn } from '@/lib/utils'

type FilterTab = 'pending' | 'completed' | 'skipped' | 'all'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<any>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('pending')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      setSession(currentSession)
      
      if (!currentSession) {
        setLoading(false)
        return
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .single()
      
      if (profileData) setProfile(profileData)

      // Fetch tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', currentSession.user.id)
        .order('ai_score', { ascending: false, nullsFirst: false })
      
      if (tasksData) setTasks(tasksData)
      setLoading(false)
    }

    // Initial fetch
    fetchData()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        fetchData()
      } else if (event === 'SIGNED_OUT') {
        setProfile(null)
        setTasks([])
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleTaskAdded = (task: Task) => {
    setTasks(prev => [task, ...prev].sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0)))
    showToast(`✓ Task scored: ${task.ai_score}/100`)
  }

  const handleComplete = async (id: string) => {
    const completedAt = new Date().toISOString()
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' as const, completed_at: completedAt } : t))
    
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: completedAt })
      .eq('id', id)

    if (error) {
      showToast('Error updating task.')
      console.error(error)
    } else {
      showToast('✓ Task completed!')
    }
  }

  const handleSkip = async (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'skipped' as const } : t))
    
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'skipped' })
      .eq('id', id)

    if (error) {
      showToast('Error updating task.')
      console.error(error)
    } else {
      showToast('Task deferred.')
    }
  }

  const handleDelete = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      showToast('Error deleting task.')
      console.error(error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
    setTasks([])
  }

  const filteredTasks = tasks.filter(t => {
    if (filter === 'all') return true
    return t.status === filter
  })

  const topTask = tasks.find(t => t.status === 'pending')

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'pending', label: 'To Do' },
    { key: 'completed', label: 'Done' },
    { key: 'skipped', label: 'Skipped' },
    { key: 'all', label: 'All' },
  ]

  if (loading && session) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-ink/10 rounded-xl" />
          <div className="h-4 w-24 bg-ink/5 rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream grain text-ink">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-ink text-cream text-xs font-body px-4 py-2.5
          rounded-xl shadow-xl animate-slide-up">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-cream/80 backdrop-blur-md border-b border-ink/8">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center text-sm">🛡</div>
            <span className="font-display font-bold text-ink text-lg">PriorityGuard</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/focus')}
              className="hidden sm:flex items-center gap-1.5 btn-primary text-xs py-2 px-3"
            >
              <Zap size={12} />
              Focus Mode
            </button>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              {profile ? (
                <div className="flex items-center gap-2">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-ink/10 flex items-center justify-center">
                      <User size={13} className="text-mist" />
                    </div>
                  )}
                  <button onClick={handleLogout} className="text-mist hover:text-ink transition-colors">
                    <LogOut size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => router.push('/login')}
                  className="bg-ink text-cream px-3 py-1.5 rounded-lg text-xs font-body font-medium hover:bg-ink/90 transition-all"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Greeting */}
        <div className="mb-6 animate-fade-in">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},
            {profile?.full_name?.split(' ')[0] ? ` ${profile.full_name.split(' ')[0]}` : ' Friend'}.
          </h1>
          <p className="font-body text-mist text-sm mt-1">
            {topTask
              ? `Your highest-value task right now: "${topTask.title}"`
              : 'All clear! Add your tasks for the day.'}
          </p>
        </div>

        {/* Stats */}
        <div className="mb-5 animate-fade-in">
          <StatsBar tasks={tasks} hourlyRate={profile?.hourly_rate ?? 50} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main task list */}
          <div className="lg:col-span-2 space-y-4">
            {/* Add task */}
            <AddTaskForm onTaskAdded={handleTaskAdded} session={session} />

            {/* Filter tabs */}
            <div className="flex gap-1 bg-white/50 rounded-xl p-1 border border-ink/6">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={cn(
                    'flex-1 py-1.5 px-2 rounded-lg text-xs font-body font-medium transition-all duration-150',
                    filter === tab.key
                      ? 'bg-ink text-cream shadow-sm'
                      : 'text-mist hover:text-ink'
                  )}
                >
                  {tab.label}
                  {tab.key !== 'all' && (
                    <span className="ml-1 opacity-60">
                      {tasks.filter(t => t.status === tab.key).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Task list */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-24 bg-white/50 rounded-2xl border border-ink/6 animate-pulse" />
                ))}
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-mist font-body">
                <div className="text-3xl mb-3">
                  {filter === 'completed' ? '🎯' : filter === 'skipped' ? '⏭' : '✨'}
                </div>
                <p className="text-sm">
                  {filter === 'pending'
                    ? 'No pending tasks. Add one above!'
                    : filter === 'completed'
                    ? 'Nothing completed yet today.'
                    : filter === 'skipped'
                    ? 'No skipped tasks.'
                    : 'No tasks yet today.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isTop={i === 0 && filter === 'pending'}
                    onComplete={handleComplete}
                    onSkip={handleSkip}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <RevenueAudit tasks={tasks} profile={profile} />

            <IntegrationPanel
              gmailEnabled={profile?.gmail_sync_enabled ?? false}
              calendarEnabled={profile?.calendar_sync_enabled ?? false}
              onTasksImported={() => {}}
              session={session}
            />

            {/* Focus mode CTA */}
            <div className="bg-ink text-cream rounded-2xl p-5 space-y-3">
              <div className="font-display text-base font-semibold">
                ⚡ Focus Mode
              </div>
              <p className="font-body text-xs text-cream/60 leading-relaxed">
                Enter distraction-free mode. One task at a time, no list to scroll.
              </p>
              <button
                onClick={() => router.push('/focus')}
                className="w-full bg-amber text-ink font-body font-medium text-xs py-2.5 rounded-xl
                  hover:bg-amber-light transition-colors active:scale-95"
              >
                Enter Focus Mode →
              </button>
            </div>

            {/* Hourly rate setting */}
            <div className="bg-white/50 border border-ink/8 rounded-2xl p-4">
              <h4 className="font-body text-xs font-semibold text-ink mb-2">Your Hourly Rate</h4>
              <div className="flex items-center gap-2">
                <span className="text-mist text-xs font-body">$</span>
                <input
                  type="number"
                  defaultValue={profile?.hourly_rate ?? 50}
                  className="input-field text-xs py-1.5 font-mono"
                  onBlur={async e => {
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val) && val > 0 && profile) {
                      setProfile(p => p ? { ...p, hourly_rate: val } : null)
                      showToast('Rate updated.')
                      await supabase
                        .from('profiles')
                        .update({ hourly_rate: val })
                        .eq('id', profile.id)
                    }
                  }}
                  min="1"
                />
                <span className="text-mist text-xs font-body">/hr</span>
              </div>
              <p className="text-xs text-mist/60 font-body mt-1.5">
                Used to calculate revenue protection
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Chat Coach */}
      <ChatCoach tasks={tasks} />
    </div>
  )
}
