import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIScoreResult, Task, Profile } from '@/types'

// Deterministic Scoring (Weighted Decision Tree)
export function calculateTaskScoreLocal(
  task: { title: string; due_date?: string | null; estimated_value?: number | null; estimated_duration_mins?: number | null },
  profile: Pick<Profile, 'hourly_rate' | 'work_start_hour' | 'work_end_hour'>
) {
  // 1. Revenue Impact (40%)
  const taskValue = task.estimated_value || 0;
  const durationHours = (task.estimated_duration_mins || 60) / 60;
  const taskHourlyRate = durationHours > 0 ? taskValue / durationHours : 0;
  
  // Normalize against user's target hourly rate
  let impactScore = Math.min(100, Math.round((taskHourlyRate / profile.hourly_rate) * 80));
  if (taskValue === 0) impactScore = 20; // baseline for non-revenue tasks
  
  // 2. Deadline Proximity (30%)
  let urgencyScore = 30; // default medium-low urgency
  if (task.due_date) {
    const hoursUntilDue = (new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilDue < 0) urgencyScore = 100; // Overdue
    else if (hoursUntilDue <= 2) urgencyScore = 95;
    else if (hoursUntilDue <= 8) urgencyScore = 80;
    else if (hoursUntilDue <= 24) urgencyScore = 60;
    else urgencyScore = Math.max(10, 60 - Math.floor(hoursUntilDue / 24) * 5);
  }
  
  // 3. Cognitive Load / Effort (30%)
  // Approximated by duration length
  let effortScore = 50;
  if (durationHours > 3) effortScore = 90;
  else if (durationHours > 1) effortScore = 70;
  else if (durationHours < 0.5) effortScore = 20;

  // Weighted Combination
  const overall = Math.round((impactScore * 0.45) + (urgencyScore * 0.40) + ((100 - effortScore) * 0.15));
  
  let reasoning = '';
  if (overall >= 80) reasoning = `High revenue potential ($${taskHourlyRate.toFixed(0)}/hr) and tight deadline. Do this FIRST.`;
  else if (impactScore > 70) reasoning = `Strong revenue driver but low urgency. Schedule for peak morning hours.`;
  else if (urgencyScore > 80) reasoning = `High urgency, but low revenue impact. Get this out of the way quickly.`;
  else reasoning = `Low impact administrative task. Procrastination trap: defer to low-energy afternoon hours.`;

  return { 
    overall_score: Math.min(100, Math.max(0, overall)), 
    urgency_score: urgencyScore, 
    impact_score: impactScore, 
    effort_score: effortScore, 
    reasoning,
    estimated_value: taskValue || null,
    recommended_duration_mins: task.estimated_duration_mins || null
  };
}

// Anti-Procrastination LLM
export async function generateBreakdownWithGemini(
  title: string, 
  description?: string | null,
  retries = 2
): Promise<{ breakdown: string[], category: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("No GEMINI_API_KEY found, using mock breakdown.");
    return {
      breakdown: ["1. Review task scope (5m)", "2. Begin structured execution (20m)", "3. Final QA/Review (5m)"],
      category: "Uncategorized"
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    
    const prompt = `You are a high-performance Anti-Procrastination & Economics Coach. 
Your goal is to help a high-earner decide what to work on right now.

TASK: "${title}"
DESCRIPTION: "${description || 'No description provided.'}"

INSTRUCTIONS:
1. BREAKDOWN: Create a 3-step action plan to overcome starting friction. Each step must be under 15 minutes.
2. CATEGORIZATION: Decide if this task is a "High-Impact" revenue driver, a "Low-Impact Administrative" necessity, or a "Procrastination Trap" (busywork that feels like work but adds no value).

Respond ONLY with raw JSON:
{
  "breakdown": ["1. [Step] ([mins]m)", "2. [Step] ([mins]m)", "3. [Step] ([mins]m)"],
  "category": "High-Impact" | "Low-Impact Administrative" | "Procrastination Trap"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const clean = text.replace(/```json|```/gi, '').trim();
    const parsed = JSON.parse(clean);
    
    return {
      breakdown: Array.isArray(parsed.breakdown) ? parsed.breakdown : ["Start immediately (5m)", "Focus on core objective (20m)", "Review and complete (5m)"],
      category: parsed.category || "Uncategorized"
    };
  } catch (err: any) {
    console.error("Gemini connection error (Switching to Safe Fallback):", err.message);
    
    // SAFE FALLBACK: Never throw, always return a default strategy
    return {
      breakdown: ["1. Review task scope (5m)", "2. Focus intently (20m)", "3. Document result (5m)"],
      category: "Uncategorized (Offline Mode)"
    };
  }
}

// Keep the interface to not break API routes
export async function scoreTaskWithAI(
  task: { title: string; description?: string | null; due_date?: string | null; estimated_value?: number | null },
  profile: Pick<Profile, 'hourly_rate' | 'work_start_hour' | 'work_end_hour'>,
  existingTasks: Array<any>
): Promise<AIScoreResult> {
  const scores = calculateTaskScoreLocal(task, profile);
  const gemini = await generateBreakdownWithGemini(task.title, task.description);
  
  return {
    ...scores,
    breakdown: gemini.breakdown,
    category: gemini.category
  };
}
