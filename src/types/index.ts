export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  hourly_rate: number
  work_start_hour: number
  work_end_hour: number
  google_access_token: string | null
  google_refresh_token: string | null
  google_token_expiry: string | null
  gmail_sync_enabled: boolean
  calendar_sync_enabled: boolean
  last_briefing_at: string | null
  created_at: string
  updated_at: string
}

export type TaskSource = 'manual' | 'voice' | 'gmail' | 'calendar'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'deferred'

export interface Task {
  id: string
  user_id: string
  title: string
  description: string | null
  source: TaskSource
  status: TaskStatus
  estimated_value: number | null
  estimated_duration_mins: number | null
  hourly_rate_at_creation: number | null
  ai_score: number | null
  ai_reasoning: string | null
  ai_breakdown: string[] | null
  ai_category: string | null
  ai_urgency_score: number | null
  ai_impact_score: number | null
  ai_effort_score: number | null
  ai_scored_at: string | null
  due_date: string | null
  scheduled_for: string | null
  completed_at: string | null
  gmail_message_id: string | null
  calendar_event_id: string | null
  delegation_brief: string | null
  created_at: string
  updated_at: string
}

export interface FocusSession {
  id: string
  user_id: string
  task_id: string | null
  started_at: string
  ended_at: string | null
  duration_mins: number | null
  outcome: 'completed' | 'skipped' | 'interrupted' | 'in_progress' | null
  created_at: string
}

export interface DailySummary {
  id: string
  user_id: string
  date: string
  tasks_completed: number
  tasks_skipped: number
  high_value_completed: number
  low_value_completed: number
  estimated_revenue_protected: number
  drift_score: number
  created_at: string
}

export interface AIScoreResult {
  overall_score: number
  urgency_score: number
  impact_score: number
  effort_score: number
  reasoning: string
  breakdown: string[]
  category: string
  estimated_value: number | null
  recommended_duration_mins: number | null
}

export interface GmailTask {
  gmail_message_id: string
  title: string
  description: string
  due_date: string | null
}

export interface CalendarTask {
  calendar_event_id: string
  title: string
  description: string | null
  due_date: string
  estimated_duration_mins: number | null
}

export type CreateTaskInput = {
  title: string
  description?: string
  source: TaskSource
  due_date?: string
  estimated_value?: number
  estimated_duration_mins?: number
}
