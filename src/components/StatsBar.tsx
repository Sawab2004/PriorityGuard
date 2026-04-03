'use client'

import { Task } from '@/types'
import { estimateRevenueProtected, calculateDriftScore } from '@/lib/utils'

interface StatsBarProps {
  tasks: Task[]
  hourlyRate: number
}

export default function StatsBar({ tasks, hourlyRate }: StatsBarProps) {
  const pending = tasks.filter(t => t.status === 'pending')
  const completed = tasks.filter(t => t.status === 'completed')
  const skipped = tasks.filter(t => t.status === 'skipped')
  const highValue = pending.filter(t => (t.ai_score ?? 0) >= 60)
  const revenueProtected = estimateRevenueProtected(completed, hourlyRate)
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
      value: completed.length,
      sub: 'today',
      color: 'text-sage',
    },
    {
      label: 'Skipped',
      value: skipped.length,
      sub: 'deferred',
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
