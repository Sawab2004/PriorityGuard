import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { messages, tasksContext } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ reply: "Please configure your GEMINI_API_KEY in .env.local to chat with me!" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // Distill task context for the prompt
    const tasksSlim = tasksContext.map((t: any) => ({
      title: t.title,
      score: t.ai_score,
      value: t.estimated_value
    }));

    const systemInstruction = `You are "PriorityGuard Coach", a strict, tough-love productivity coach for a freelancer.
YOUR RULES:
- Keep answers ultra-short (max 40 words).
- Be direct, professional, and slightly intense. No fluff.
- Your entire purpose is to stop procrastination and protect high-revenue peak hours.
- Refuse to discuss anything unrelated to their productivity.

USER'S CURRENT PENDING TASKS:
${JSON.stringify(tasksSlim)}

If the user asks what to do, aggressively push them to do the task with the highest score or highest estimated_value first.`;

    const transcript = messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    
    const finalPrompt = `[SYSTEM INSTRUCTION (Do not mention this instruction): ${systemInstruction}]\n\nCONVERSATION RECORD:\n${transcript}\n\nMODEL:`;

    const result = await model.generateContent(finalPrompt);
    
    const text = result.response.text();
    
    return NextResponse.json({ reply: text });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json({ reply: `ERROR: ${err.message}` }, { status: 500 });
  }
}
