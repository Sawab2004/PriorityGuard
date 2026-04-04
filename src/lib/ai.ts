import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIScoreResult, Task, Profile } from '@/types'

// ─── Title-based heuristics ────────────────────────────────────────────────
// Used when structured fields (estimated_value, due_date, etc.) are absent.

const HIGH_IMPACT_KEYWORDS = [
  'client', 'proposal', 'invoice', 'contract', 'pitch', 'presentation',
  'deadline', 'launch', 'deploy', 'submit', 'deliver', 'send', 'publish',
  'meeting', 'call', 'demo', 'interview', 'negotiat', 'close', 'sale',
]

const LOW_IMPACT_KEYWORDS = [
  'clean', 'organize', 'sort', 'tidy', 'read', 'browse', 'check',
  'update profile', 'update bio', 'reply', 'follow up', 'admin',
  'file', 'backup', 'archive',
]

const URGENCY_KEYWORDS = [
  'urgent', 'asap', 'today', 'now', 'immediately', 'critical',
  'overdue', 'late', 'due', 'deadline', 'emergency',
]

function inferImpactFromTitle(title: string): number | null {
  const lower = title.toLowerCase()
  if (HIGH_IMPACT_KEYWORDS.some(kw => lower.includes(kw))) return 65
  if (LOW_IMPACT_KEYWORDS.some(kw => lower.includes(kw))) return 15
  return null // no signal — truly unknown
}

function inferUrgencyFromTitle(title: string): number | null {
  const lower = title.toLowerCase()
  if (URGENCY_KEYWORDS.some(kw => lower.includes(kw))) return 75
  return null
}

// ─── Deterministic Scoring (Weighted Decision Tree) ────────────────────────

export function calculateTaskScoreLocal(
  task: {
    title: string
    due_date?: string | null
    estimated_value?: number | null
    estimated_duration_mins?: number | null
  },
  profile: Pick<Profile, 'hourly_rate' | 'work_start_hour' | 'work_end_hour'>
) {
  const durationHours = (task.estimated_duration_mins || 60) / 60

  // ── Impact Score ──────────────────────────────────────────────────────────
  let impactScore: number
  const hasEconomicData = task.estimated_value != null && task.estimated_value > 0

  if (hasEconomicData) {
    const taskValue = task.estimated_value!
    const taskHourlyRate = durationHours > 0 ? taskValue / durationHours : 0
    impactScore = Math.min(100, Math.round((taskHourlyRate / profile.hourly_rate) * 80))
  } else {
    // Fall back to title keyword inference
    const inferred = inferImpactFromTitle(task.title)
    impactScore = inferred ?? 30 // neutral unknown baseline
  }

  // ── Urgency Score ─────────────────────────────────────────────────────────
  let urgencyScore: number

  if (task.due_date) {
    const hoursUntilDue = (new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursUntilDue < 0) urgencyScore = 100
    else if (hoursUntilDue <= 2) urgencyScore = 95
    else if (hoursUntilDue <= 8) urgencyScore = 80
    else if (hoursUntilDue <= 24) urgencyScore = 60
    else urgencyScore = Math.max(10, 60 - Math.floor(hoursUntilDue / 24) * 5)
  } else {
    // Fall back to title keyword inference
    const inferred = inferUrgencyFromTitle(task.title)
    urgencyScore = inferred ?? 30 // no urgency signal
  }

  // ── Effort Score ──────────────────────────────────────────────────────────
  let effortScore = 50
  if (durationHours > 3) effortScore = 90
  else if (durationHours > 1) effortScore = 70
  else if (durationHours < 0.5) effortScore = 20

  // ── Weighted Combination ──────────────────────────────────────────────────
  const overall = Math.round(
    (impactScore * 0.45) + (urgencyScore * 0.40) + ((100 - effortScore) * 0.15)
  )

  // ── Reasoning ─────────────────────────────────────────────────────────────
  const taskValue = task.estimated_value ?? 0
  const taskHourlyRate = hasEconomicData
    ? Math.round(taskValue / durationHours)
    : null

  let reasoning = ''
  const noStructuredData = !hasEconomicData && !task.due_date

  if (noStructuredData) {
    if (overall >= 60) {
      reasoning = `Title suggests high-impact work. Add an estimated value and due date for a precise score.`
    } else {
      reasoning = `No economic data provided. Score is estimated from task title — add a value and deadline to improve accuracy.`
    }
  } else if (overall >= 80) {
    reasoning = taskHourlyRate
      ? `High revenue potential ($${taskHourlyRate}/hr) and tight deadline. Do this FIRST.`
      : `High urgency task. Get this done before anything else.`
  } else if (impactScore > 70) {
    reasoning = `Strong revenue driver but low urgency. Schedule for peak morning hours.`
  } else if (urgencyScore > 80) {
    reasoning = `High urgency, but low revenue impact. Get this out of the way quickly.`
  } else {
    reasoning = `Low impact administrative task. Procrastination trap: defer to low-energy afternoon hours.`
  }

  return {
    overall_score: Math.min(100, Math.max(0, overall)),
    urgency_score: urgencyScore,
    impact_score: impactScore,
    effort_score: effortScore,
    reasoning,
    estimated_value: taskValue || null,
    recommended_duration_mins: task.estimated_duration_mins || null,
  }
}

// ─── Anti-Procrastination LLM (Gemini) ────────────────────────────────────

export async function generateBreakdownWithGemini(
  title: string,
  description?: string | null,
  retries = 2
): Promise<{ breakdown: string[]; category: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('No GEMINI_API_KEY found, using mock breakdown.')
    return {
      breakdown: [
        '1. Review task scope (5m)',
        '2. Begin structured execution (20m)',
        '3. Final QA/Review (5m)',
      ],
      category: 'Uncategorized',
    }
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' })

    const prompt = `You are a high-performance Anti-Procrastination & Economics Coach.
Your goal is to help a high-earner decide what to work on right now.

TASK: "${title}"
DESCRIPTION: "${description || 'No description provided.'}"

INSTRUCTIONS:
1. BREAKDOWN: Create a 3-step action plan to overcome starting friction. Each step must be specific to this task and under 15 minutes.
2. CATEGORIZATION: Decide if this task is a "High-Impact" revenue driver, a "Low-Impact Administrative" necessity, or a "Procrastination Trap" (busywork that feels like work but adds no value).

IMPORTANT: Steps must be specific to the task title. Do NOT produce generic steps like "start immediately" or "review scope".

Respond ONLY with raw JSON:
{
  "breakdown": ["1. [Specific step] ([mins]m)", "2. [Specific step] ([mins]m)", "3. [Specific step] ([mins]m)"],
  "category": "High-Impact" | "Low-Impact Administrative" | "Procrastination Trap"
}`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    const clean = text.replace(/```json|```/gi, '').trim()
    const parsed = JSON.parse(clean)

    return {
      breakdown: Array.isArray(parsed.breakdown)
        ? parsed.breakdown
        : ['Start immediately (5m)', 'Focus on core objective (20m)', 'Review and complete (5m)'],
      category: parsed.category || 'Uncategorized',
    }
  } catch (err: any) {
    console.error('Gemini connection error (Switching to Safe Fallback):', err.message)
    return {
      breakdown: [
        '1. Review task scope (5m)',
        '2. Focus intently (20m)',
        '3. Document result (5m)',
      ],
      category: 'Uncategorized (Offline Mode)',
    }
  }
}

// ─── Public interface (used by API routes) ─────────────────────────────────

export async function scoreTaskWithAI(
  task: {
    title: string
    description?: string | null
    due_date?: string | null
    estimated_value?: number | null
  },
  profile: Pick<Profile, 'hourly_rate' | 'work_start_hour' | 'work_end_hour'>,
  existingTasks: Array<any>
): Promise<AIScoreResult> {
  const scores = calculateTaskScoreLocal(task, profile)
  const gemini = await generateBreakdownWithGemini(task.title, task.description)

  return {
    ...scores,
    breakdown: gemini.breakdown,
    category: gemini.category,
  }
}