'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, Plus, X, Loader2 } from 'lucide-react'
import { CreateTaskInput, Task } from '@/types'
import { cn } from '@/lib/utils'

// --- Speech Recognition Types ---
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (event: Event) => void
  onresult: (event: SpeechRecognitionEvent) => void
  onerror: (event: any) => void
  onend: (event: Event) => void
  start: () => void
  stop: () => void
}
// --------------------------------

interface AddTaskFormProps {
  onTaskAdded: (task: Task) => void
  session?: any
}

export default function AddTaskForm({ onTaskAdded, session }: AddTaskFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '',
    description: '',
    due_date: '',
    estimated_value: '',
    estimated_duration_mins: '',
  })

  // Load draft from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('pg_task_draft')
    if (saved) {
      try {
        setForm(JSON.parse(saved))
        setOpen(true) // Re-open if there was a draft
      } catch (e) {
        console.error("Failed to parse task draft", e)
      }
    }
  }, [])

  // Save draft to localStorage whenever it changes
  useEffect(() => {
    const hasContent = Object.values(form).some(v => v !== '')
    if (hasContent) {
      localStorage.setItem('pg_task_draft', JSON.stringify(form))
    } else {
      localStorage.removeItem('pg_task_draft')
    }
  }, [form])

  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const startVoice = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError('Voice input not supported in this browser. Try Chrome.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.continuous = false

    recognition.onstart = () => setRecording(true)

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const result = e.results[e.results.length - 1]
      const text = result[0].transcript
      setTranscript(text)
      if (result.isFinal) {
        setForm(f => ({ ...f, title: text }))
        setTranscript('')
        setRecording(false)
      }
    }

    recognition.onerror = () => {
      setRecording(false)
      setTranscript('')
    }

    recognition.onend = () => {
      setRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [])

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop()
    setRecording(false)
    setTranscript('')
  }, [])

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError('Please enter a task title.')
      return
    }

    setError('')
    setLoading(true)

    const payload: CreateTaskInput = {
      title: form.title.trim(),
      source: transcript ? 'voice' : 'manual',
      description: form.description || undefined,
      due_date: form.due_date || undefined,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : undefined,
      estimated_duration_mins: form.estimated_duration_mins
        ? parseInt(form.estimated_duration_mins)
        : undefined,
    }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Failed to save task')

      onTaskAdded(data.task)
      localStorage.removeItem('pg_task_draft')
      setForm({ title: '', description: '', due_date: '', estimated_value: '', estimated_duration_mins: '' })
      setOpen(false)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-ink/15
          hover:border-amber/50 hover:bg-amber/3 text-mist hover:text-amber transition-all duration-200
          font-body text-sm group"
      >
        <div className="w-8 h-8 rounded-full bg-ink/5 group-hover:bg-amber/10 flex items-center justify-center transition-colors">
          <Plus size={16} />
        </div>
        Add a task — or speak it
        <Mic size={14} className="ml-auto opacity-50 group-hover:opacity-100" />
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-amber/25 bg-white/60 backdrop-blur-sm p-5 shadow-sm animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base font-semibold text-ink">New Task</h3>
        <button onClick={() => setOpen(false)} className="text-mist hover:text-ink transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Voice + title row */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={recording ? 'Listening…' : 'Task title'}
            value={recording && transcript ? transcript : form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="input-field pr-4"
            onKeyDown={e => e.key === 'Enter' && !loading && handleSubmit()}
            autoFocus
          />
          {recording && (
            <div className="absolute inset-0 rounded-xl border-2 border-amber/50 pointer-events-none animate-pulse" />
          )}
        </div>

        <button
          type="button"
          onClick={recording ? stopVoice : startVoice}
          className={cn(
            'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200',
            recording
              ? 'bg-rust text-white voice-recording shadow-lg shadow-rust/25'
              : 'bg-ink/8 text-mist hover:bg-amber/10 hover:text-amber'
          )}
          title={recording ? 'Stop recording' : 'Speak your task'}
        >
          {recording ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
      </div>

      {recording && (
        <p className="text-xs text-amber font-body mb-3 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-rust rounded-full animate-pulse" />
          Listening — speak your task clearly
        </p>
      )}

      {/* Optional fields */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs font-body text-mist mb-1 block">Due date</label>
          <input
            type="datetime-local"
            value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
            className="input-field text-xs py-2"
          />
        </div>
        <div>
          <label className="text-xs font-body text-mist mb-1 block">Revenue Value / Impact Score ($)</label>
          <input
            type="number"
            placeholder="e.g. 500"
            value={form.estimated_value}
            onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))}
            className="input-field text-xs py-2"
            min="0"
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs font-body text-mist mb-1 block">Duration (minutes)</label>
        <input
          type="number"
          placeholder="e.g. 60"
          value={form.estimated_duration_mins}
          onChange={e => setForm(f => ({ ...f, estimated_duration_mins: e.target.value }))}
          className="input-field text-xs py-2"
          min="1"
        />
      </div>

      <div className="mb-4">
        <label className="text-xs font-body text-mist mb-1 block">Notes (optional)</label>
        <textarea
          placeholder="Additional context…"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          className="input-field text-xs py-2 resize-none"
          rows={2}
        />
      </div>

      {error && (
        <p className="text-xs text-rust font-body mb-3 bg-rust/5 border border-rust/15 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading || !form.title.trim() || !session}
          className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Scoring with AI…
            </>
          ) : (
            <>
              <Plus size={14} />
              {!session ? 'Sign in to Add Task' : 'Add & Score'}
            </>
          )}
        </button>
        <button onClick={() => setOpen(false)} className="btn-secondary px-4">
          Cancel
        </button>
      </div>

      <p className="text-xs text-mist/60 font-body mt-2 text-center">
        Gemini will instantly score this task by revenue impact & urgency
      </p>
    </div>
  )
}
