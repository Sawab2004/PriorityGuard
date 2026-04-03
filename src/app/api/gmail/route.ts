import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { fetchGmailTasks } from '@/lib/google'
import { scoreTaskWithAI } from '@/lib/ai'

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile?.google_access_token || !profile?.gmail_sync_enabled) {
    return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
  }

  const gmailTasks = await fetchGmailTasks(
    profile.google_access_token,
    profile.google_refresh_token
  )

  if (gmailTasks.length === 0) {
    return NextResponse.json({ message: 'No actionable emails found', imported: 0 })
  }

  // Check for existing imports to avoid duplicates
  const { data: existing } = await supabase
    .from('tasks')
    .select('gmail_message_id')
    .eq('user_id', session.user.id)
    .not('gmail_message_id', 'is', null)

  const existingIds = new Set(existing?.map(t => t.gmail_message_id) || [])
  const newTasks = gmailTasks.filter(t => !existingIds.has(t.gmail_message_id))

  if (newTasks.length === 0) {
    return NextResponse.json({ message: 'All emails already imported', imported: 0 })
  }

  const { data: existingPending } = await supabase
    .from('tasks')
    .select('title, ai_score, status')
    .eq('user_id', session.user.id)
    .eq('status', 'pending')
    .limit(10)

  const today = new Date().toISOString().split('T')[0]
  const inserted = []

  for (const gmailTask of newTasks) {
    const aiResult = await scoreTaskWithAI(
      { title: gmailTask.title, description: gmailTask.description, due_date: gmailTask.due_date },
      { hourly_rate: profile.hourly_rate, work_start_hour: profile.work_start_hour, work_end_hour: profile.work_end_hour },
      existingPending || []
    )

    const { data } = await supabase
      .from('tasks')
      .insert({
        user_id: session.user.id,
        title: gmailTask.title,
        description: gmailTask.description,
        source: 'gmail',
        status: 'pending',
        ai_score: aiResult.overall_score,
        ai_reasoning: aiResult.reasoning,
        ai_breakdown: aiResult.breakdown,
        ai_category: aiResult.category,
        ai_urgency_score: aiResult.urgency_score,
        ai_impact_score: aiResult.impact_score,
        ai_effort_score: aiResult.effort_score,
        ai_scored_at: new Date().toISOString(),
        due_date: gmailTask.due_date,
        scheduled_for: today,
        gmail_message_id: gmailTask.gmail_message_id,
        hourly_rate_at_creation: profile.hourly_rate,
      })
      .select()
      .single()

    if (data) inserted.push(data)
  }

  return NextResponse.json({ message: `Imported ${inserted.length} tasks`, imported: inserted.length, tasks: inserted })
}
