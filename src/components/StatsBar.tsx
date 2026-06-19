'use client'

import { Task } from '@/types'
import { estimateRevenueProtected, calculateDriftScore } from '@/lib/utils'

interface StatsBarProps {
  tasks: Task[]
  hourlyRate: number
}

export default function StatsBar({ tasks, hourlyRate }: StatsBarProps) {
  const todayStr = new Date().toISOString().split('T')[0]
  const isToday = (dateStr: string | null) => !!dateStr && dateStr.split('T')[0] === todayStr

  const pending = tasks.filter(t => t.status === 'pending')
  // "Completed today" and "Skipped" should only count today's activity —
  // otherwise these numbers silently include all-time history once the
  // dashboard fetches more than just today's tasks.
  const completedToday = tasks.filter(t => t.status === 'completed' && isToday(t.completed_at))
  const skippedToday = tasks.filter(t => t.status === 'skipped' && isToday(t.updated_at))
  const highValue = pending.filter(t => (t.ai_score ?? 0) >= 60)
  const revenueProtected = estimateRevenueProtected(completedToday, hourlyRate)
  const driftScore = calculateDriftScore(tasks)

  const stats = [
    {
      label: 'Pending',
      value: pending.length,
      sub: `${highValue.length} high-value`,
      color: 'text-ink',
    },
    {
      label: 'Completed',
      value: completedToday.length,
      sub: 'today',
      color: 'text-sage',
    },
    {
      label: 'Skipped',
      value: skippedToday.length,
      sub: 'today',
      color: 'text-mist',
    },
    {
      label: 'Revenue Protected',
      value: `$${revenueProtected.toFixed(0)}`,
      sub: 'est. today',
      color: 'text-amber',
    },
    {
      label: 'Drift Score',
      value: `${driftScore}%`,
      sub: driftScore > 50 ? '⚠ High drift' : driftScore > 25 ? 'Moderate' : '✓ On track',
      color: driftScore > 50 ? 'text-rust' : driftScore > 25 ? 'text-amber' : 'text-sage',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {stats.map(stat => (
        <div
          key={stat.label}
          className="bg-white/60 backdrop-blur-sm border border-ink/6 rounded-xl p-3 text-center"
        >
          <div className={`font-mono text-xl font-semibold ${stat.color}`}>
            {stat.value}
          </div>
          <div className="font-body text-xs text-ink mt-0.5">{stat.label}</div>
          <div className="font-body text-xs text-mist/70 mt-0.5">{stat.sub}</div>
        </div>
      ))}
    </div>
  )
}