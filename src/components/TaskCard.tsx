'use client'

import { useState } from 'react'
import { Task } from '@/types'
import {
  getScoreColor, getScoreBg, getScoreLabel, getScoreBarColor,
  formatDuration, formatDueDate, getSourceIcon, cn
} from '@/lib/utils'
import { CheckCircle, Clock, SkipForward, Trash2, ChevronDown, ChevronUp, User, Copy, Loader2, Pencil, X, Save } from 'lucide-react'

interface TaskCardProps {
  task: Task
  onComplete: (id: string) => void | Promise<void>
  onSkip: (id: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onTaskUpdated?: (task: Task) => void
  isTop?: boolean
}

export default function TaskCard({ task, onComplete, onSkip, onDelete, onTaskUpdated, isTop }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [delegationBrief, setDelegationBrief] = useState<string | null>(task.delegation_brief || null)
  const [delegateError, setDelegateError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // ── Inline editing state ───────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    title: task.title,
    description: task.description || '',
    due_date: task.due_date ? task.due_date.slice(0, 16) : '', // trim to datetime-local format
    estimated_value: task.estimated_value?.toString() || '',
    estimated_duration_mins: task.estimated_duration_mins?.toString() || '',
  })

  const startEditing = () => {
    setEditForm({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date ? task.due_date.slice(0, 16) : '',
      estimated_value: task.estimated_value?.toString() || '',
      estimated_duration_mins: task.estimated_duration_mins?.toString() || '',
    })
    setEditError(null)
    setIsEditing(true)
    setExpanded(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditError(null)
  }

  const saveEdit = async () => {
    if (!editForm.title.trim()) {
      setEditError('Title cannot be empty.')
      return
    }

    setLoading('edit')
    setEditError(null)

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          due_date: editForm.due_date ? new Date(editForm.due_date).toISOString() : null,
          estimated_value: editForm.estimated_value ? parseFloat(editForm.estimated_value) : null,
          estimated_duration_mins: editForm.estimated_duration_mins
            ? parseInt(editForm.estimated_duration_mins)
            : null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Could not save changes. Please try again.')
      }

      onTaskUpdated?.(data.task)
      setIsEditing(false)
    } catch (err: any) {
      setEditError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const handleComplete = async () => {
    setLoading('complete')
    await onComplete(task.id)
    setLoading(null)
  }

  const handleSkip = async () => {
    setLoading('skip')
    await onSkip(task.id)
    setLoading(null)
  }

  const handleDelete = async () => {
    setLoading('delete')
    await onDelete(task.id)
    setLoading(null)
  }

  const handleDelegate = async () => {
    setLoading('delegate')
    setDelegateError(null)
    try {
      const res = await fetch('/api/ai/delegate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          title: task.title,
          description: task.description
        })
      })

      if (!res.ok) {
        throw new Error(res.status === 404 ? 'Delegation feature is not available yet.' : 'Could not generate a brief. Please try again.')
      }

      const data = await res.json()
      if (data.brief) {
        setDelegationBrief(data.brief)
        setExpanded(true)
      } else {
        throw new Error('No brief was returned. Please try again.')
      }
    } catch (err: any) {
      console.error('Delegate error:', err)
      setDelegateError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const copyBrief = async () => {
    if (!delegationBrief) return
    try {
      await navigator.clipboard.writeText(delegationBrief)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setDelegateError('Could not copy to clipboard. Please select and copy manually.')
    }
  }

  const score = task.ai_score
  const scoreLabel = getScoreLabel(score)
  const scoreBg = getScoreBg(score)
  const scoreColor = getScoreColor(score)
  const scoreBarColor = getScoreBarColor(score)

  return (
    <div
      className={cn(
        'task-item relative rounded-2xl border p-5 transition-all duration-200',
        scoreBg,
        isTop && 'focus-spotlight ring-1 ring-amber/30'
      )}
    >
      {isTop && (
        <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-amber to-transparent" />
      )}

      <div className="flex items-start gap-4">
        {/* Score circle */}
        <div className={cn(
          'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center',
          'border-2 font-mono font-semibold text-sm',
          score !== null ? `${scoreColor} border-current` : 'text-mist border-mist/30'
        )}>
          {score ?? '?'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              {isTop && (
                <span className="tag bg-amber/15 text-amber-dark mb-1.5">
                  ⚡ Do this first
                </span>
              )}
              <h3 className="font-body font-medium text-ink text-sm leading-snug">
                {task.title}
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
              <button
                onClick={startEditing}
                disabled={isEditing}
                className="text-mist hover:text-ink transition-colors disabled:opacity-30"
                title="Edit task"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-mist hover:text-ink transition-colors"
              >
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className={cn('tag', score !== null && score >= 60
              ? 'bg-amber/10 text-amber-dark'
              : 'bg-mist/15 text-mist'
            )}>
              {scoreLabel}
            </span>
            <span className="text-xs text-mist font-body flex items-center gap-1">
              {getSourceIcon(task.source)} {task.source}
            </span>
            {task.due_date && (
              <span className="text-xs text-mist font-body flex items-center gap-1">
                <Clock size={10} />
                {formatDueDate(task.due_date)}
              </span>
            )}
            {task.estimated_duration_mins && (
              <span className="text-xs text-mist font-body">
                ~{formatDuration(task.estimated_duration_mins)}
              </span>
            )}
          </div>

          {/* Score bar */}
          {score !== null && (
            <div className="mt-3 h-1 bg-ink/8 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full score-bar', scoreBarColor)}
                style={{ width: `${score}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 pl-16 animate-fade-in space-y-3">
          {isEditing ? (
            <div className="bg-white/60 rounded-xl p-4 border border-amber/25 space-y-3">
              <div>
                <label className="text-xs font-body text-mist mb-1 block">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="input-field text-sm py-2"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-body text-mist mb-1 block">Due date</label>
                  <input
                    type="datetime-local"
                    value={editForm.due_date}
                    onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                    className="input-field text-xs py-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-body text-mist mb-1 block">Value ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.estimated_value}
                    onChange={e => setEditForm(f => ({ ...f, estimated_value: e.target.value }))}
                    className="input-field text-xs py-2"
                    placeholder="e.g. 500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-body text-mist mb-1 block">Duration (minutes)</label>
                <input
                  type="number"
                  min="1"
                  value={editForm.estimated_duration_mins}
                  onChange={e => setEditForm(f => ({ ...f, estimated_duration_mins: e.target.value }))}
                  className="input-field text-xs py-2"
                  placeholder="e.g. 60"
                />
              </div>

              <div>
                <label className="text-xs font-body text-mist mb-1 block">Notes</label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  className="input-field text-xs py-2 resize-none"
                  rows={2}
                />
              </div>

              {editError && (
                <p className="text-xs text-rust font-body bg-rust/5 border border-rust/15 rounded-lg px-3 py-2">
                  {editError}
                </p>
              )}

              <p className="text-[10px] text-mist/60 font-body">
                Saving will re-score this task using your updated value, duration, and due date.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  disabled={loading !== null}
                  className="flex-1 flex items-center justify-center gap-1.5 btn-primary text-xs py-2 disabled:opacity-50"
                >
                  {loading === 'edit'
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Save size={12} />
                  }
                  Save & Re-score
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={loading !== null}
                  className="flex items-center justify-center gap-1.5 btn-secondary text-xs py-2 px-4"
                >
                  <X size={12} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
          {task.ai_category && (
            <div className="flex">
              <span className="tag bg-white/40 border border-ink/10 text-ink/80 text-[10px] tracking-wider uppercase">
                {task.ai_category}
              </span>
            </div>
          )}

          {task.ai_breakdown && task.ai_breakdown.length > 0 && (
            <div className="bg-amber/10 rounded-xl p-3 border border-amber/20 shadow-inner">
              <p className="text-[10px] font-bold tracking-widest uppercase text-amber-dark mb-2">Smart Breakdown</p>
              <ul className="space-y-1.5 list-none">
                {task.ai_breakdown.map((step, idx) => (
                  <li key={idx} className="text-xs font-body text-ink/80 flex items-start gap-2">
                    <span className="text-amber mt-0.5 opacity-80">→</span> 
                    <span className="leading-snug">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {task.ai_reasoning && (
            <div className="bg-white/50 rounded-xl p-3 border border-ink/6">
              <p className="text-xs font-body text-ink/70 leading-relaxed">
                <span className="font-medium text-ink">Scoring Rationale: </span>
                {task.ai_reasoning}
              </p>
            </div>
          )}

          {task.description && (
            <p className="text-xs font-body text-mist leading-relaxed">{task.description}</p>
          )}

          {/* Delegation Brief */}
          {delegationBrief && (
            <div className="bg-sage/5 rounded-xl p-4 border border-sage/15 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold tracking-widest uppercase text-sage">VA Delegation Brief</p>
                <button onClick={copyBrief} className="text-sage hover:text-sage-dark flex items-center gap-1 text-[10px] uppercase font-bold transition-colors">
                  <Copy size={12} /> {copied ? 'Copied!' : 'Copy Brief'}
                </button>
              </div>
              <div className="text-xs font-body text-sage/80 leading-relaxed whitespace-pre-wrap italic">
                {delegationBrief}
              </div>
            </div>
          )}

          {/* Sub-scores */}
          {(task.ai_urgency_score || task.ai_impact_score || task.ai_effort_score) && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Urgency', value: task.ai_urgency_score },
                { label: 'Impact', value: task.ai_impact_score },
                { label: 'Effort', value: task.ai_effort_score },
              ].map(({ label, value }) => (
                <div key={label} className="text-center bg-white/40 rounded-lg p-2">
                  <div className="font-mono text-sm font-medium text-ink">{value ?? '—'}</div>
                  <div className="text-xs text-mist font-body">{label}</div>
                </div>
              ))}
            </div>
          )}
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pl-16">
        <button
          onClick={handleComplete}
          disabled={loading !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-sage/10 text-sage border border-sage/20
            hover:bg-sage/20 rounded-lg text-xs font-body font-medium transition-all duration-150 active:scale-95
            disabled:opacity-50"
        >
          {loading === 'complete'
            ? <div className="w-3 h-3 border border-sage/40 border-t-sage rounded-full animate-spin" />
            : <CheckCircle size={12} />
          }
          Done
        </button>

        <button
          onClick={handleSkip}
          disabled={loading !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-mist/10 text-mist border border-mist/20
            hover:bg-mist/20 rounded-lg text-xs font-body font-medium transition-all duration-150 active:scale-95
            disabled:opacity-50"
        >
          {loading === 'skip'
            ? <div className="w-3 h-3 border border-mist/40 border-t-mist rounded-full animate-spin" />
            : <SkipForward size={12} />
          }
          Skip
        </button>

        {/* Delegate Button for Low-Impact tasks */}
        {(task.ai_category === 'Low-Impact Administrative' || task.ai_category === 'Procrastination Trap') && !delegationBrief && (
          <button
            onClick={handleDelegate}
            disabled={loading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber/10 text-amber-dark border border-amber/20
              hover:bg-amber/20 rounded-lg text-xs font-body font-medium transition-all duration-150 active:scale-95
              disabled:opacity-50"
          >
            {loading === 'delegate'
              ? <Loader2 size={12} className="animate-spin" />
              : <User size={12} />
            }
            Delegate
          </button>
        )}

        {delegateError && (
          <span className="text-xs text-rust font-body">{delegateError}</span>
        )}

        <button
          onClick={handleDelete}
          disabled={loading !== null}
          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-rust/60 hover:text-rust
            hover:bg-rust/5 rounded-lg text-xs transition-all duration-150 active:scale-95 disabled:opacity-50"
        >
          {loading === 'delete'
            ? <div className="w-3 h-3 border border-rust/40 border-t-rust rounded-full animate-spin" />
            : <Trash2 size={12} />
          }
        </button>
      </div>
    </div>
  )
}