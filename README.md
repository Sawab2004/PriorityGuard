# 🛡 PriorityGuard

**AI-powered cognitive prioritization for freelancers.**  
Stop wasting your peak hours on $15/hr tasks.
https://priority-guard.vercel.app/dashboard
---

## What It Does

PriorityGuard is an MVP for AI-4013 Phase 3. It helps solopreneurs and freelancers protect their peak cognitive hours by using Claude AI to automatically score and prioritize tasks by economic value, urgency, and cognitive effort.

**Core user flow:**
1. Add tasks via text or voice
2. Claude AI instantly scores each task (0–100) based on revenue impact, urgency, and effort
3. Dashboard shows tasks ranked by score — highest value first
4. Focus Mode: one task at a time, distraction-free
5. Sync tasks from Gmail (action emails) and Google Calendar events

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend & API | Next.js 14 (App Router) |
| Database & Auth | Supabase (PostgreSQL + Google OAuth) |
| AI Prioritization | Anthropic Claude claude-sonnet-4-20250514 |
| Google Integration | Gmail API + Calendar API |
| Voice Input | Web Speech API (browser-native) |
| Styling | Tailwind CSS + Google Fonts |

---

## Setup Instructions

### 1. Clone and install

```bash
git clone <your-repo>
cd priorityguard
npm install
```

### 2. Configure environment variables

Copy `.env.local` and fill in your values:

```bash
cp .env.local .env.local.filled
```

Required variables:
```
NEXT_PUBLIC_SUPABASE_URL=         # From Supabase project settings
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # From Supabase project settings  
SUPABASE_SERVICE_ROLE_KEY=        # From Supabase project settings (secret)
ANTHROPIC_API_KEY=                # From console.anthropic.com
GOOGLE_CLIENT_ID=                 # From Google Cloud Console
GOOGLE_CLIENT_SECRET=             # From Google Cloud Console
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-string>   # Run: openssl rand -base64 32
```

### 3. Set up Supabase

1. Go to your Supabase project → **SQL Editor**
2. Copy and run the entire contents of `supabase-schema.sql`
3. Go to **Authentication → Providers → Google** and enable it
4. Add your Google OAuth credentials to Supabase

### 4. Set up Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable these APIs:
   - **Gmail API**
   - **Google Calendar API**
   - **Google+ API** (for user info)
4. Go to **Credentials → Create OAuth 2.0 Client ID**
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback` (Supabase)
     - `http://localhost:3000/api/auth/google/callback` (Gmail/Calendar)
5. Copy the Client ID and Secret to your `.env.local`

### 5. Configure Supabase Google Auth

In Supabase Dashboard:
- Authentication → Providers → Google
- Paste your Google Client ID and Client Secret
- Set redirect URL to: `http://localhost:3000/api/auth/callback`

### 6. Run the app

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── tasks/          # GET (list), POST (create + AI score)
│   │   │   └── [id]/       # PATCH (update status), DELETE
│   │   ├── gmail/          # POST (sync Gmail → tasks)
│   │   ├── calendar/       # POST (sync Calendar → tasks)
│   │   └── auth/
│   │       ├── callback/   # Supabase OAuth callback
│   │       └── google/callback/  # Google Gmail/Calendar OAuth
│   ├── dashboard/          # Main dashboard page
│   ├── focus/              # Focus mode (one task at a time)
│   ├── login/              # Login page
│   └── globals.css
├── components/
│   ├── TaskCard.tsx        # Individual task with score, actions
│   ├── AddTaskForm.tsx     # Text + voice task input
│   ├── StatsBar.tsx        # Daily stats (revenue protected, drift)
│   └── IntegrationPanel.tsx # Gmail/Calendar sync controls
├── lib/
│   ├── ai.ts               # Claude AI scoring engine
│   ├── google.ts           # Gmail + Calendar API
│   ├── supabase.ts         # Supabase client factories
│   └── utils.ts            # Helpers, formatters
└── types/
    └── index.ts            # TypeScript types
```

---

## Key Features

### AI Task Scoring
Each task is scored by Claude on three dimensions:
- **Urgency** (0–100): Time pressure, proximity to deadline
- **Impact** (0–100): Revenue and business value
- **Effort** (0–100): Cognitive demand (high effort → do it first)

The overall score determines task order. Score 80+ = "Critical, do now."

### Voice Input
Uses the browser's native Web Speech API — no cost, no external service.
Works best in Chrome. Click the mic icon in the Add Task form.

### Focus Mode
A dark, distraction-free screen showing one task at a time.
Users can complete or skip tasks. The AI reasoning is shown so users understand *why* a task is ranked #1.

### Drift Score
Measures the % of completed tasks that were low-value.
High drift = productive procrastination detected.

### Revenue Protection
Estimates income "protected" by completing high-value tasks today, based on your hourly rate.

---

## MVP Scope — What's Included vs Excluded

| Included | Excluded |
|---|---|
| Google OAuth login | Email/password auth |
| Text + voice task input | Mobile app |
| Claude AI prioritization | Long-term analytics |
| Gmail actionable email sync | Full email management |
| Google Calendar event sync | Calendar editing |
| Focus Mode | Team collaboration |
| Daily stats (drift, revenue) | Gantt charts / PM features |
| Hourly rate configuration | Billing / payments |

---

## Assumptions Being Tested (Phase 3)

1. **Seeing a high score motivates action** — Does the AI score actually change which task a user starts with?
2. **Voice input reduces friction** — Do users prefer speaking tasks over typing?
3. **Focus Mode reduces task-switching** — Does one-task-at-a-time improve completion of high-value work?
4. **Revenue framing creates urgency** — Does "$X revenue protected" motivate users more than a simple to-do list?

---

## Known Limitations

- Voice input requires Chrome (Web Speech API)
- Gmail sync only pulls emails with action keywords — not perfect
- AI scoring is only as good as the task title; vague titles = neutral scores
- No recurring tasks or long-term scheduling
- Cold start: AI scoring improves with more context but works from day 1
