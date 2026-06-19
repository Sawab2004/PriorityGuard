import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createServerClient } from '@/lib/supabase/server'

const MAX_MESSAGES = 20          // cap how much history we forward to Gemini
const MAX_MESSAGE_LENGTH = 2000  // guard against pasted essays blowing up the prompt

type ChatMessage = { role: 'user' | 'model'; content: string }

export async function POST(req: NextRequest) {
  // Require auth — this endpoint costs real Gemini quota per call.
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { messages?: ChatMessage[]; tasksContext?: any[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { messages, tasksContext } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages must be a non-empty array' }, { status: 400 })
  }

  const validMessages = messages.every(
    m => m && (m.role === 'user' || m.role === 'model') && typeof m.content === 'string'
  )
  if (!validMessages) {
    return NextResponse.json({ error: 'Invalid message format' }, { status: 400 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      reply: "I'm not connected yet — add a GEMINI_API_KEY to enable the coach.",
    })
  }

  // Trim history and per-message length so a runaway thread can't blow up cost.
  const trimmedMessages = messages
    .slice(-MAX_MESSAGES)
    .map(m => ({ ...m, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }))

  const tasksSlim = Array.isArray(tasksContext)
    ? tasksContext.slice(0, 15).map((t: any) => ({
        title: typeof t?.title === 'string' ? t.title.slice(0, 200) : 'Untitled',
        score: t?.ai_score ?? null,
        value: t?.estimated_value ?? null,
      }))
    : []

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash-latest', // consistent with lib/ai.ts
      systemInstruction: `You are "PriorityGuard Coach", a strict, tough-love productivity coach for a freelancer.
RULES:
- Keep answers ultra-short (max 40 words).
- Be direct, professional, and slightly intense. No fluff.
- Your entire purpose is to stop procrastination and protect high-revenue peak hours.
- Refuse to discuss anything unrelated to their productivity.
- If asked what to do next, push them toward the pending task with the highest score or highest estimated value.

USER'S CURRENT PENDING TASKS:
${JSON.stringify(tasksSlim)}`,
    })

    // Use Gemini's native chat history format instead of hand-rolled string concatenation.
    const history = trimmedMessages.slice(0, -1).map(m => ({
      role: m.role,
      parts: [{ text: m.content }],
    }))
    const lastMessage = trimmedMessages[trimmedMessages.length - 1]

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(lastMessage.content)
    const text = result.response.text()

    return NextResponse.json({ reply: text })
  } catch (err: any) {
    console.error('Chat API error:', err)
    // Never leak raw error text into the chat UI as if the coach said it.
    return NextResponse.json(
      { reply: "Couldn't reach the coach right now. Just start your top task." },
      { status: 200 } // keep 200 so the UI renders a graceful in-chat message, not a thrown error
    )
  }
}