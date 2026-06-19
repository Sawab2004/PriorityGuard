import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { fetchCalendarTasks } from '@/lib/google'
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

  if (!profile?.google_access_token || !profile?.calendar_sync_enabled) {
    return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 })
  }

  // Token refresh callback — persists new credentials to the profile row,
  // matching the Gmail route so calendar sync doesn't break every hour
  // when the access token expires.
  const onTokenRefresh = async (newAccessToken: string, expiryDate: number) => {
    await supabase
      .from('profiles')
      .update({
        google_access_token: newAccessToken,
        google_token_expiry: new Date(expiryDate).toISOString(),
      })
      .eq('id', session.user.id)
  }

  let calendarTasks
  try {
    calendarTasks = await fetchCalendarTasks(
      profile.google_access_token,
      profile.google_refresh_token,
      onTokenRefresh
    )
  } catch (err: any) {
    // This try/catch was previously missing entirely, so an expired token
    // (or any other failure inside fetchCalendarTasks) surfaced as an
    // unhandled 500 with no useful message — which is what showed up in
    // the UI as the generic "Sync failed. Try again."
    if (err.message === 'GOOGLE_AUTH_EXPIRED') {
      await supabase
        .from('profiles')
        .update({ calendar_sync_enabled: false })
        .eq('id', session.user.id)
      return NextResponse.json(
        { error: 'Calendar authorization expired. Please reconnect your Google account.' },
        { status: 401 }
      )
    }
    console.error('Calendar sync failed:', err)
    return NextResponse.json({ error: 'Calendar sync failed' }, { status: 500 })
  }

  if (calendarTasks.length === 0) {
    return NextResponse.json({ message: 'No upcoming events found', imported: 0 })
  }

  const { data: existing } = await supabase
    .from('tasks')
    .select('calendar_event_id')
    .eq('user_id', session.user.id)
    .not('calendar_event_id', 'is', null)

  const existingIds = new Set(existing?.map(t => t.calendar_event_id) || [])
  const newTasks = calendarTasks.filter(t => !existingIds.has(t.calendar_event_id))

  if (newTasks.length === 0) {
    return NextResponse.json({ message: 'All events already imported', imported: 0 })
  }

  const { data: existingPending } = await supabase
    .from('tasks')
    .select('title, ai_score, status')
    .eq('user_id', session.user.id)
    .eq('status', 'pending')
    .limit(10)

  const today = new Date().toISOString().split('T')[0]
  const inserted = []

  for (const calTask of newTasks) {
    const aiResult = await scoreTaskWithAI(
      { title: calTask.title, description: calTask.description, due_date: calTask.due_date },
      { hourly_rate: profile.hourly_rate, work_start_hour: profile.work_start_hour, work_end_hour: profile.work_end_hour },
      existingPending || []
    )

    const { data } = await supabase
      .from('tasks')
      .insert({
        user_id: session.user.id,
        title: calTask.title,
        description: calTask.description,
        source: 'calendar',
        status: 'pending',
        estimated_duration_mins: calTask.estimated_duration_mins,
        ai_score: aiResult.overall_score,
        ai_reasoning: aiResult.reasoning,
        ai_breakdown: aiResult.breakdown,
        ai_category: aiResult.category,
        ai_urgency_score: aiResult.urgency_score,
        ai_impact_score: aiResult.impact_score,
        ai_effort_score: aiResult.effort_score,
        ai_scored_at: new Date().toISOString(),
        due_date: calTask.due_date,
        scheduled_for: today,
        calendar_event_id: calTask.calendar_event_id,
        hourly_rate_at_creation: profile.hourly_rate,
      })
      .select()
      .single()

    if (data) inserted.push(data)
  }

  return NextResponse.json({ message: `Imported ${inserted.length} events`, imported: inserted.length, tasks: inserted })
}