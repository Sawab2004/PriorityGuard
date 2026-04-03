import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { scoreTaskWithAI } from '@/lib/ai'
import { CreateTaskInput } from '@/types'

// GET /api/tasks — list today's tasks for the authenticated user
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const status = searchParams.get('status') // optional filter

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', session.user.id)
    .order('ai_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (date) {
    query = query.eq('scheduled_for', date)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tasks: data })
}

// POST /api/tasks — create a new task and immediately score it with AI
export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateTaskInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Task title is required' }, { status: 400 })
  }

  // Fetch user profile for scoring context
  const { data: profile } = await supabase
    .from('profiles')
    .select('hourly_rate, work_start_hour, work_end_hour')
    .eq('id', session.user.id)
    .single()

  // Fetch existing tasks for context
  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('title, ai_score, status')
    .eq('user_id', session.user.id)
    .eq('status', 'pending')
    .limit(10)

  // STEP 1: Score the task using local math (always works — no AI needed)
  const { calculateTaskScoreLocal } = await import('@/lib/ai')
  const localScores = calculateTaskScoreLocal(
    {
      title: body.title,
      due_date: body.due_date,
      estimated_value: body.estimated_value,
      estimated_duration_mins: body.estimated_duration_mins,
    },
    profile || { hourly_rate: 50, work_start_hour: 9, work_end_hour: 18 }
  )

  const today = new Date().toISOString().split('T')[0]

  // STEP 2: Insert task immediately with local scores (never blocked by AI)
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      user_id: session.user.id,
      title: body.title.trim(),
      description: body.description || null,
      source: body.source || 'manual',
      status: 'pending',
      estimated_value: localScores.estimated_value ?? body.estimated_value ?? null,
      estimated_duration_mins: localScores.recommended_duration_mins ?? body.estimated_duration_mins ?? null,
      hourly_rate_at_creation: profile?.hourly_rate ?? 50,
      ai_score: localScores.overall_score,
      ai_reasoning: localScores.reasoning,
      ai_breakdown: ['1. Review task scope (5m)', '2. Execute with focus (20m)', '3. Review & complete (5m)'],
      ai_category: 'Uncategorized',
      ai_urgency_score: localScores.urgency_score,
      ai_impact_score: localScores.impact_score,
      ai_effort_score: localScores.effort_score,
      ai_scored_at: new Date().toISOString(),
      due_date: body.due_date || null,
      scheduled_for: today,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // STEP 3: Try Gemini enrichment in background (best-effort, non-blocking)
  // We respond immediately and update the task quietly if AI succeeds
  ;(async () => {
    try {
      const { generateBreakdownWithGemini } = await import('@/lib/ai')
      const gemini = await generateBreakdownWithGemini(body.title, body.description)
      if (gemini.category !== 'Uncategorized (Offline Mode)') {
        await supabase
          .from('tasks')
          .update({
            ai_breakdown: gemini.breakdown,
            ai_category: gemini.category,
          })
          .eq('id', task.id)
      }
    } catch (e) {
      // Silently ignore — task is already saved
      console.warn('Background AI enrichment skipped:', e)
    }
  })()

  return NextResponse.json({ task }, { status: 201 })
}
