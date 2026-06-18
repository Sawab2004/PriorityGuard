'use client'

import { useState } from 'react'

type Step = 'closed' | 'form' | 'done'

const DISAPPOINTMENT_OPTIONS = [
  { value: 'very', label: 'Very disappointed' },
  { value: 'somewhat', label: 'Somewhat disappointed' },
  { value: 'not', label: 'Not disappointed' },
]

const RECOMMEND_OPTIONS = [
  { value: '5', label: 'Definitely' },
  { value: '4', label: 'Probably' },
  { value: '3', label: 'Maybe' },
  { value: '2', label: 'Probably not' },
  { value: '1', label: 'No' },
]

export default function FeedbackSection() {
  const [step, setStep] = useState<Step>('closed')
  const [disappointment, setDisappointment] = useState('')
  const [recommend, setRecommend] = useState('')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = disappointment && recommend

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disappointment, recommend: parseInt(recommend), comment }),
      })
      if (!res.ok) throw new Error('Failed to submit')
      setStep('done')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Closed state — just a small prompt ──────────────────────────────────
  if (step === 'closed') {
    return (
      <div className="mt-8 border border-white/10 rounded-xl p-4 flex items-center justify-between bg-white/[0.03]">
        <div>
          <p className="text-sm font-medium text-white/80">Help shape PriorityGuard</p>
          <p className="text-xs text-white/40 mt-0.5">Takes 30 seconds. No account needed.</p>
        </div>
        <button
          onClick={() => setStep('form')}
          className="text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white transition-colors"
        >
          Give feedback
        </button>
      </div>
    )
  }

  // ── Done state ──────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="mt-8 border border-white/10 rounded-xl p-6 bg-white/[0.03] text-center">
        <p className="text-2xl mb-2">🙏</p>
        <p className="text-sm font-medium text-white/80">Thanks for the feedback.</p>
        <p className="text-xs text-white/40 mt-1">It helps more than you think.</p>
      </div>
    )
  }

  // ── Form state ──────────────────────────────────────────────────────────
  return (
    <div className="mt-8 border border-white/10 rounded-xl p-6 bg-white/[0.03]">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-white/90 tracking-wide uppercase">Feedback</h3>
        <button
          onClick={() => setStep('closed')}
          className="text-white/30 hover:text-white/60 transition-colors text-lg leading-none"
          aria-label="Close feedback"
        >
          ×
        </button>
      </div>

      {/* Q1 */}
      <div className="mb-6">
        <p className="text-xs font-medium text-white/60 mb-3">
          How disappointed would you be if PriorityGuard disappeared tomorrow?
          <span className="text-red-400 ml-1">*</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {DISAPPOINTMENT_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setDisappointment(o.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                disappointment === o.value
                  ? 'bg-indigo-500 border-indigo-400 text-white'
                  : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/70'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Q2 */}
      <div className="mb-6">
        <p className="text-xs font-medium text-white/60 mb-3">
          Would you recommend PriorityGuard to another freelancer?
          <span className="text-red-400 ml-1">*</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {RECOMMEND_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setRecommend(o.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                recommend === o.value
                  ? 'bg-indigo-500 border-indigo-400 text-white'
                  : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/70'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Q3 — free text */}
      <div className="mb-6">
        <p className="text-xs font-medium text-white/60 mb-2">
          Anything else? Bugs, missing features, what's working well.
        </p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Type here..."
          rows={3}
          maxLength={1000}
          className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder-white/25 resize-none focus:outline-none focus:border-indigo-500/60 transition-colors"
        />
        <p className="text-right text-xs text-white/20 mt-1">{comment.length}/1000</p>
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-4">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || loading}
        className="w-full py-2.5 rounded-lg text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
      >
        {loading ? 'Submitting...' : 'Submit feedback'}
      </button>

      <p className="text-xs text-white/25 text-center mt-3">
        Responses are anonymous and stored securely.
      </p>
    </div>
  )
}