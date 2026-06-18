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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to submit')
      }
      setStep('done')
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'closed') {
    return (
      <div className="mt-8 bg-white/50 border border-ink/8 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="font-body text-sm font-semibold text-ink">Help shape PriorityGuard</p>
          <p className="font-body text-xs text-mist mt-0.5">Takes 30 seconds.</p>
        </div>
        <button
          onClick={() => setStep('form')}
          className="btn-primary text-xs py-2 px-4"
        >
          Give feedback
        </button>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="mt-8 bg-white/50 border border-ink/8 rounded-2xl p-6 text-center">
        <p className="text-2xl mb-2">🙏</p>
        <p className="font-body text-sm font-semibold text-ink">Thanks for the feedback.</p>
        <p className="font-body text-xs text-mist mt-1">It helps more than you think.</p>
      </div>
    )
  }

  return (
    <div className="mt-8 bg-white/50 border border-ink/8 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-body text-xs font-semibold text-ink tracking-widest uppercase">Feedback</h3>
        <button
          onClick={() => setStep('closed')}
          className="text-mist hover:text-ink transition-colors text-xl leading-none"
          aria-label="Close feedback"
        >
          ×
        </button>
      </div>

      {/* Q1 */}
      <div className="mb-6">
        <p className="font-body text-xs font-medium text-ink mb-3">
          How disappointed would you be if PriorityGuard disappeared tomorrow?
          <span className="text-red-500 ml-1">*</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {DISAPPOINTMENT_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setDisappointment(o.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-body font-medium border transition-all ${
                disappointment === o.value
                  ? 'bg-ink text-cream border-ink'
                  : 'bg-white border-ink/12 text-mist hover:border-ink/30 hover:text-ink'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Q2 */}
      <div className="mb-6">
        <p className="font-body text-xs font-medium text-ink mb-3">
          Would you recommend PriorityGuard to another freelancer?
          <span className="text-red-500 ml-1">*</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {RECOMMEND_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setRecommend(o.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-body font-medium border transition-all ${
                recommend === o.value
                  ? 'bg-ink text-cream border-ink'
                  : 'bg-white border-ink/12 text-mist hover:border-ink/30 hover:text-ink'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Q3 */}
      <div className="mb-6">
        <p className="font-body text-xs font-medium text-ink mb-2">
          Anything else? Bugs, missing features, what's working well.
        </p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Type here..."
          rows={3}
          maxLength={1000}
          className="input-field text-xs resize-none w-full"
        />
        <p className="text-right font-body text-xs text-mist mt-1">{comment.length}/1000</p>
      </div>

      {error && (
        <p className="font-body text-xs text-red-500 mb-4">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || loading}
        className="btn-primary w-full py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Submitting...' : 'Submit feedback'}
      </button>

      <p className="font-body text-xs text-mist text-center mt-3">
        Responses are stored securely.
      </p>
    </div>
  )
}