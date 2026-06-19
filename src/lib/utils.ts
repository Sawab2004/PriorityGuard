import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Task } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getScoreColor(score: number | null): string {
  if (score === null) return 'text-mist'
  if (score >= 80) return 'text-rust'
  if (score >= 60) return 'text-amber'
  if (score >= 40) return 'text-sage'
  return 'text-mist'
}

export function getScoreBg(score: number | null): string {
  if (score === null) return 'bg-mist/20'
  if (score >= 80) return 'bg-rust/10 border-rust/30'
  if (score >= 60) return 'bg-amber/10 border-amber/30'
  if (score >= 40) return 'bg-sage/10 border-sage/30'
  return 'bg-mist/10 border-mist/30'
}

export function getScoreLabel(score: number | null): string {
  if (score === null) return 'Unscored'
  if (score >= 80) return 'Critical'
  if (score >= 60) return 'High Value'
  if (score >= 40) return 'Medium'
  if (score >= 20) return 'Low'
  return 'Defer'
}

export function getScoreBarColor(score: number | null): string {
  if (score === null) return 'bg-mist'
  if (score >= 80) return 'bg-rust'
  if (score >= 60) return 'bg-amber'
  if (score >= 40) return 'bg-sage'
  return 'bg-mist'
}

export function formatDuration(mins: number | null): string {
  if (!mins) return '—'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return 'No deadline'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours < 0) return 'Overdue'
  if (diffHours < 1) return `${Math.round(diffHours * 60)}m left`
  if (diffHours < 24) return `${Math.round(diffHours)}h left`
  if (diffHours < 48) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function estimateRevenueProtected(tasks: Task[], hourlyRate: number): number {
  // Previously this only counted completed tasks scored >= 60, so
  // finishing a lower-priority task contributed $0 even though real
  // time was spent on it. Revenue Protected should reflect the value
  // of ALL completed work today, not just the high-value subset —
  // that distinction already lives in Drift Score, which separately
  // measures how much of your completed work was low-value.
  return tasks
    .filter(t => t.status === 'completed')
    .reduce((acc, t) => {
      if (t.estimated_value) return acc + t.estimated_value
      if (t.estimated_duration_mins) return acc + (t.estimated_duration_mins / 60) * hourlyRate
      return acc + hourlyRate * 0.5 // assume 30 min for unestimated tasks
    }, 0)
}

export function calculateDriftScore(tasks: Task[]): number {
  const completed = tasks.filter(t => t.status === 'completed')
  if (completed.length === 0) return 0

  // Drift = % of completed tasks that were LOW value (score < 40)
  const lowValueDone = completed.filter(t => (t.ai_score ?? 50) < 40).length
  return Math.round((lowValueDone / completed.length) * 100)
}

export function getSourceIcon(source: string): string {
  switch (source) {
    case 'voice': return '🎙️'
    case 'gmail': return '📧'
    case 'calendar': return '📅'
    default: return '✏️'
  }
}