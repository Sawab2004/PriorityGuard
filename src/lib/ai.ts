import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIScoreResult, Task, Profile } from '@/types'

// ─── Title-based heuristics ────────────────────────────────────────────────
// Tiered keywords: CRITICAL > HIGH > MEDIUM > LOW
// Scores are spread across the full 0–100 range so no-data tasks still
// produce meaningful differentiation rather than piling up at one value.

const CRITICAL_IMPACT_KEYWORDS = [
  'invoice', 'contract', 'close', 'sale', 'signed', 'payment', 'revenue',
  'launch', 'deploy', 'ship', 'go live',
]

const HIGH_IMPACT_KEYWORDS = [
  'client', 'proposal', 'pitch', 'presentation', 'demo', 'interview',
  'negotiat', 'deliver', 'submit', 'publish', 'send', 'deadline',
]

const MEDIUM_IMPACT_KEYWORDS = [
  'meeting', 'call', 'review', 'feedback', 'approve', 'plan', 'design',
  'build', 'write', 'create', 'develop', 'fix', 'update', 'implement',
]

const LOW_IMPACT_KEYWORDS = [
  'clean', 'organize', 'sort', 'tidy', 'browse', 'check',
  'update profile', 'update bio', 'admin', 'file', 'backup', 'archive',
  'read', 'watch', 'explore',
]

const CRITICAL_URGENCY_KEYWORDS = [
  'urgent', 'asap', 'emergency', 'critical', 'immediately', 'overdue', 'late',
]

const HIGH_URGENCY_KEYWORDS = [
  'today', 'now', 'due', 'deadline', 'eod', 'end of day',
]

function inferImpactFromTitle(title: string): { score: number; tier: string } {
  const lower = title.toLowerCase()
  if (CRITICAL_IMPACT_KEYWORDS.some(kw => lower.includes(kw))) return { score: 85, tier: 'critical' }
  if (HIGH_IMPACT_KEYWORDS.some(kw => lower.includes(kw)))     return { score: 68, tier: 'high' }
  if (MEDIUM_IMPACT_KEYWORDS.some(kw => lower.includes(kw)))   return { score: 50, tier: 'medium' }
  if (LOW_IMPACT_KEYWORDS.some(kw => lower.includes(kw)))      return { score: 18, tier: 'low' }
  return { score: 42, tier: 'unknown' } // neutral — meaningful midpoint, not a basement
}

function inferUrgencyFromTitle(title: string): number | null {
  const lower = title.toLowerCase()
  if (CRITICAL_URGENCY_KEYWORDS.some(kw => lower.includes(kw))) return 88
  if (HIGH_URGENCY_KEYWORDS.some(kw => lower.includes(kw)))     return 70
  return null // no signal — genuinely unknown
}

// ─── Smooth urgency curve ──────────────────────────────────────────────────
// Replaces hard cliffs with a continuous curve so nearby deadlines
// don't cause jarring re-rankings minute to minute.

function urgencyFromHours(hoursUntilDue: number): number {
  if (hoursUntilDue < 0)   return 100                          // overdue
  if (hoursUntilDue === 0) return 100
  // Exponential decay: 100 at 0h, ~88 at 2h, ~72 at 8h, ~55 at 24h, ~35 at 72h, floors at 12
  const raw = 100 * Math.exp(-0.012 * hoursUntilDue)
  return Math.round(Math.max(12, Math.min(100, raw)))
}

// ─── Deterministic Scoring ─────────────────────────────────────────────────

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
  const hasEconomicData = task.estimated_value != null && task.estimated_value > 0

  // ── Impact Score (0–100) ──────────────────────────────────────────────────
  // Fix: cap removed (was * 0.80), now full 0–100 range
  // Fix: unknown fallback raised from 30 → 42 (true midpoint)
  let impactScore: number
  let impactTier = 'unknown'

  if (hasEconomicData) {
    const taskValue        = task.estimated_value!
    const taskHourlyRate   = durationHours > 0 ? taskValue / durationHours : taskValue
    const ratio            = taskHourlyRate / (profile.hourly_rate || 50)
    // Logarithmic scale: ratio=0.5 → ~55, ratio=1 → ~70, ratio=2 → ~85, ratio=4 → ~100
    impactScore = Math.round(Math.min(100, Math.max(0, 70 + 30 * Math.log2(ratio) / 2)))
    impactTier  = ratio >= 2 ? 'critical' : ratio >= 1 ? 'high' : ratio >= 0.5 ? 'medium' : 'low'
  } else {
    const inferred = inferImpactFromTitle(task.title)
    impactScore    = inferred.score
    impactTier     = inferred.tier
  }

  // ── Urgency Score (0–100) ─────────────────────────────────────────────────
  // Fix: continuous exponential curve instead of hard step brackets
  // Fix: no-date tasks differentiated by title keywords (not all stuck at 30)
  let urgencyScore: number
  let hasDeadline = false

  if (task.due_date) {
    const hoursUntilDue = (new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60)
    urgencyScore = urgencyFromHours(hoursUntilDue)
    hasDeadline  = true
  } else {
    const inferred = inferUrgencyFromTitle(task.title)
    // No date + no keyword → use a moderate default that still allows differentiation
    urgencyScore = inferred ?? 35
  }

  // ── Effort Score (0–100, inverse contribution) ────────────────────────────
  // Fix: weight raised to 20% and made continuous, not step-based
  // Shorter tasks score higher on effort (meaning they contribute more positively)
  // because quick wins that unblock other work should rank slightly higher
  // than equally-valued but very long tasks.
  let effortScore: number
  if (durationHours <= 0.25)     effortScore = 95   // <15 min — quick win
  else if (durationHours <= 0.5) effortScore = 82   // 15-30 min
  else if (durationHours <= 1)   effortScore = 70   // 30-60 min
  else if (durationHours <= 2)   effortScore = 55   // 1-2 hr
  else if (durationHours <= 4)   effortScore = 38   // 2-4 hr
  else                            effortScore = 20   // 4hr+ deep work block

  // ── Weighted Combination ──────────────────────────────────────────────────
  // Fix: weights rebalanced — impact 50%, urgency 30%, effort 20%
  // Effort now meaningful but never overrides economic signal
  const overall = Math.round(
    (impactScore  * 0.50) +
    (urgencyScore * 0.30) +
    (effortScore  * 0.20)
  )

  // ── Confidence signal ──────────────────────────────────────────────────────
  // How much structured data did we actually have?
  const dataPoints = [hasEconomicData, hasDeadline, !!task.estimated_duration_mins].filter(Boolean).length
  const confidence: 'high' | 'medium' | 'low' =
    dataPoints === 3 ? 'high' : dataPoints >= 1 ? 'medium' : 'low'

  // ── Reasoning ─────────────────────────────────────────────────────────────
  const taskValue      = task.estimated_value ?? 0
  const taskHourlyRate = hasEconomicData ? Math.round(taskValue / durationHours) : null

  let reasoning = ''

  if (confidence === 'low') {
    if (impactTier === 'critical' || impactTier === 'high') {
      reasoning = `Title signals high-value work. Add an estimated value and due date to get a precise score.`
    } else if (impactTier === 'low') {
      reasoning = `Looks like admin or low-value work. Defer to low-energy hours unless it's blocking something.`
    } else {
      reasoning = `No economic data. Score is inferred from title — add a value and deadline for accuracy.`
    }
  } else if (overall >= 80) {
    reasoning = taskHourlyRate
      ? `High revenue ($${taskHourlyRate}/hr) with a tight deadline. Do this FIRST.`
      : `High urgency task. Clear this before anything else.`
  } else if (impactScore >= 75 && urgencyScore < 50) {
    reasoning = taskHourlyRate
      ? `Strong earner ($${taskHourlyRate}/hr) but no immediate deadline. Block time for this today.`
      : `High-value work with no hard deadline. Schedule for your peak hours.`
  } else if (urgencyScore >= 75 && impactScore < 50) {
    reasoning = `Urgent but low revenue impact. Handle quickly so it stops taking mental space.`
  } else if (effortScore >= 80 && overall >= 60) {
    reasoning = `Quick win with solid value. Do this now — it'll be done before you know it.`
  } else {
    reasoning = `Low-impact task. Batch with similar work or defer to afternoon.`
  }

  if (confidence === 'medium' && !hasEconomicData) {
    reasoning += ` (Add estimated value for a more precise score.)`
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