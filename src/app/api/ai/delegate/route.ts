import { createServerClient } from '@/lib/supabase/server'
import { generateBreakdownWithGemini } from '@/lib/ai'
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { taskId, title, description } = await req.json()

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('No API Key')

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const prompt = `You are an expert Chief of Staff. I have a task that is "Low-Impact Administrative" but needs to be done. 
I want to DELEGATE this to a Virtual Assistant (VA). 

TASK: "${title}"
DESC: "${description || 'No additional context.'}"

GOAL: Write a professional, extremely clear 3-step delegation brief for a VA. 
Format it for copy-pasting. 

Include:
1. "Context": Why this needs to be done.
2. "Action Steps": Exactly what to do (Step 1, 2, 3).
3. "Success Criteria": How the VA knows they are finished.

Keep it concise but foolproof.`

    const result = await model.generateContent(prompt)
    const brief = result.response.text()

    // Update the task with the brief
    const { error } = await supabase
      .from('tasks')
      .update({ delegation_brief: brief })
      .eq('id', taskId)
      .eq('user_id', session.user.id)

    if (error) throw error

    return NextResponse.json({ brief })
  } catch (err: any) {
    console.error('Delegation failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
