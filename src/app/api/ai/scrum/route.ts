import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('No API Key')

    // Fetch pending tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('title, ai_score, ai_category, estimated_value, estimated_duration_mins')
      .eq('user_id', session.user.id)
      .eq('status', 'pending')
      .order('ai_score', { ascending: false })

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ briefing: "No tasks pending. Enjoy your clear head today!" })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const taskContext = tasks.slice(0, 5).map(t => 
      `- ${t.title} (Score: ${t.ai_score}, Cat: ${t.ai_category}, Value: $${t.estimated_value || '??'})`
    ).join('\n')

    const prompt = `You are an elite Chief of Staff for a high-earning entrepreneur. 
It is the start of the workday. Review their top tasks and provide a concise "Morning Scrum" briefing.

TOP TASKS:
${taskContext}

INSTRUCTIONS:
1. "The Big Move": Identify the single most important task today and explain WHY from a revenue/leverage perspective.
2. "Strategic Advice": Give 2-3 sentences of advice on how to structure their day (e.g. "Lock down your first 2 hours for X").
3. Tone: Professional, high-status, encouraging but strict about focus. 
4. Keep it under 150 words total.`

    const result = await model.generateContent(prompt)
    const briefing = result.response.text()

    // Update last_briefing_at
    await supabase
      .from('profiles')
      .update({ last_briefing_at: new Date().toISOString() })
      .eq('id', session.user.id)

    return NextResponse.json({ briefing })
  } catch (err: any) {
    console.error('Scrum failed:', err)
    let message = err.message || "Unknown error";
    if (message.includes('column "last_briefing_at" of relation "profiles" does not exist')) {
        message = "DATABASE SYNC REQUIRED: Please run the SQL migration (Step 1) from the walkthrough to enable daily briefings."
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
