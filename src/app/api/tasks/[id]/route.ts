import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { calculateTaskScoreLocal } from '@/lib/ai'

const EDITABLE_FIELDS = [
  'title',
  'description',
  'due_date',
  'estimated_value',
  'estimated_duration_mins',
] as const

type EditableField = typeof EDITABLE_FIELDS[number]

// PATCH /api/tasks/[id] — update task status OR edit task fields (re-scores on edit)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { status } = body

  // ── Status-only update (existing behavior, unchanged) ─────────────────────
  if (status !== undefined) {
    const validStatuses = ['pending', 'in_progress', 'completed', 'skipped', 'deferred']
    if (!validStatuses.includes(status as string)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { status }
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString()
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task })
  }

  // ── Field edit (title/description/due_date/value/duration) ────────────────
  // Only accept known editable fields — never let the request body write
  // arbitrary columns like ai_score or user_id directly.
  const edits: Partial<Record<EditableField, unknown>> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in body) edits[field] = body[field]
  }

  if (Object.keys(edits).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
  }

  if ('title' in edits) {
    const title = String(edits.title ?? '').trim()
    if (!title) {
      return NextResponse.json({ error: 'Task title cannot be empty' }, { status: 400 })
    }
    edits.title = title
  }

  // Fetch the existing task (to merge unedited fields for re-scoring)
  // and the user's profile (to re-run the same scoring formula used on creation).
  const [{ data: existingTask, error: fetchError }, { data: profile }] = await Promise.all([
    supabase.from('tasks').select('*').eq('id', params.id).eq('user_id', session.user.id).single(),
    supabase.from('profiles').select('hourly_rate, work_start_hour, work_end_hour').eq('id', session.user.id).single(),
  ])

  if (fetchError || !existingTask) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  // Merge edits onto the existing task so re-scoring sees the full,
  // up-to-date picture — not just the fields that changed.
  const merged = { ...existingTask, ...edits }

  const localScores = calculateTaskScoreLocal(
    {
      title: merged.title,
      due_date: merged.due_date,
      estimated_value: merged.estimated_value != null ? Number(merged.estimated_value) : null,
      estimated_duration_mins: merged.estimated_duration_mins != null ? Number(merged.estimated_duration_mins) : null,
    },
    profile || { hourly_rate: 50, work_start_hour: 9, work_end_hour: 18 }
  )

  const { data: task, error } = await supabase
    .from('tasks')
    .update({
      ...edits,
      ai_score: localScores.overall_score,
      ai_reasoning: localScores.reasoning,
      ai_urgency_score: localScores.urgency_score,
      ai_impact_score: localScores.impact_score,
      ai_effort_score: localScores.effort_score,
      ai_scored_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('user_id', session.user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ task })
}

// DELETE /api/tasks/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', params.id)
    .eq('user_id', session.user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}