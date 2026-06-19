import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { taskId?: string; title?: string; description?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { taskId, title, description } = body

  if (!taskId || typeof taskId !== 'string') {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  // Verify ownership BEFORE spending a Gemini call — avoids burning quota
  // on a task that doesn't belong to this user, and avoids the old bug where
  // a brief was generated and returned even though the DB update affected 0 rows.
  const { data: existingTask, error: fetchError } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .eq('user_id', session.user.id)
    .single()

  if (fetchError || !existingTask) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    // Fall back to a generic template instead of a hard failure, consistent
    // with how lib/ai.ts handles a missing key for enrichment.
    const fallbackBrief = `Context: This task needs to get done but isn't a priority for your own time.

Action Steps:
1. Review the task: "${title.trim()}"
2. Complete the work based on the description below.
3. Confirm completion and flag any blockers.

Description: ${description?.trim() || 'No additional context provided.'}

Success Criteria: Task is fully complete and matches the description above. Reply with confirmation once done.

(Note: This is a template brief — add a GEMINI_API_KEY for AI-generated briefs tailored to each task.)`

    const { error: updateError } = await supabase
      .from('tasks')
      .update({ delegation_brief: fallbackBrief })
      .eq('id', taskId)
      .eq('user_id', session.user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ brief: fallbackBrief })
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' })

    const prompt = `You are an expert Chief of Staff. I have a task that is "Low-Impact Administrative" but needs to be done.
I want to DELEGATE this to a Virtual Assistant (VA).

TASK: "${title.trim()}"
DESC: "${description?.trim() || 'No additional context.'}"

GOAL: Write a professional, extremely clear delegation brief for a VA, formatted for copy-pasting.

Include exactly these three sections:
1. "Context": Why this needs to be done.
2. "Action Steps": Exactly what to do (numbered steps).
3. "Success Criteria": How the VA knows they are finished.

Keep it concise but foolproof. Plain text only, no markdown formatting symbols.`

    const result = await model.generateContent(prompt)
    const brief = result.response.text().trim()

    if (!brief) {
      throw new Error('Gemini returned an empty response')
    }

    const { error: updateError } = await supabase
      .from('tasks')
      .update({ delegation_brief: brief })
      .eq('id', taskId)
      .eq('user_id', session.user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ brief })
  } catch (err: any) {
    console.error('Delegation failed:', err)
    return NextResponse.json(
      { error: 'Could not generate a delegation brief. Please try again.' },
      { status: 500 }
    )
  }
}