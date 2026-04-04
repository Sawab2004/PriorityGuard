# 🛡 PriorityGuard

**AI-powered cognitive prioritization for freelancers.**  
Stop wasting your peak hours on $15/hr tasks.

--- 

## What It Does

PriorityGuard is an MVP for AI-4013 Phase 3. It helps solopreneurs and freelancers protect their peak cognitive hours by automatically scoring and prioritizing tasks by economic value, urgency, and cognitive effort.

**Core user flow:**
1. Add tasks via text or voice
2. Tasks are instantly scored (0–100) using a deterministic weighted formula across revenue impact, deadline urgency, and cognitive effort
3. A background Gemini call enriches each task with a 3-step action breakdown and category label (non-blocking)
4. Dashboard shows tasks ranked by score — highest value first
5. Focus Mode: one task at a time, distraction-free
6. Sync tasks from Gmail (action emails) and Google Calendar events

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend & API | Next.js 14 (App Router) |
| Database & Auth | Supabase (PostgreSQL + Google OAuth) |
| Task Scoring | Deterministic weighted formula (local, no API) |
| AI Enrichment | Google Gemini 1.5 Flash (breakdown + category, async) |
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
GEMINI_API_KEY=                   # From Google AI Studio (console.cloud.google.com)
GOOGLE_CLIENT_ID=                 # From Google Cloud Console
GOOGLE_CLIENT_SECRET=             # From Google Cloud Console
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-string>   # Run: openssl rand -base64 32
```

> Note: If `GEMINI_API_KEY` is not set, the system falls back to a static breakdown template. Task scoring is unaffected — it runs locally with no API dependency.

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
│   │   ├── tasks/          # GET (list), POST (create + score)
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
│   ├── ai.ts               # Scoring engine (local) + Gemini enrichment
│   ├── google.ts           # Gmail + Calendar API
│   ├── supabase.ts         # Supabase client factories
│   └── utils.ts            # Helpers, formatters
└── types/
    └── index.ts            # TypeScript types
```

---

## Key Features

### Task Scoring — Two-Tier Pipeline

Task scoring uses a **two-tier pipeline** to ensure task creation is never blocked by an external API call.

**Tier 1 — Local scoring (synchronous, always runs):**  
`calculateTaskScoreLocal` computes a weighted score using three dimensions:

- **Impact** (45%): Compares the task's implied hourly rate (`estimated_value ÷ estimated_duration_mins`) against your configured hourly rate. Tasks with no `estimated_value` receive a baseline impact score of 20.
- **Urgency** (40%): Derived from `due_date` proximity. Overdue = 100, due in <2h = 95, due today = 60–80, no due date = 30.
- **Effort** (15%, inverse): Longer tasks score higher effort but contribute *less* to the overall score — the formula rewards getting high-effort work done early by slightly deprioritizing very short tasks.

The task is **inserted immediately** with these scores. The user sees their ranked task with no API wait.

**Tier 2 — Gemini enrichment (asynchronous, best-effort):**  
After the `201` response is sent, a background call to Gemini 1.5 Flash generates a 3-step action breakdown and categorizes the task as one of:
- `High-Impact` — revenue-driving work
- `Low-Impact Administrative` — necessary but low-value
- `Procrastination Trap` — busywork that feels productive but isn't

If Gemini is unavailable or the API key is missing, a static fallback is used and the task is unaffected.

> **Tip for better scores:** The formula produces its most useful rankings when tasks include an `estimated_value` (in $), an `estimated_duration_mins`, and a `due_date`. Tasks added via voice without these fields will receive a neutral score (~30–45) and be ranked below tasks with full context. The AddTaskForm accepts these as optional fields — fill them in when the economic value of the task is clear.

### Voice Input
Uses the browser's native Web Speech API — no cost, no external service.
Works best in Chrome. Click the mic icon in the Add Task form.

### Focus Mode
A dark, distraction-free screen showing one task at a time. Users can complete or skip tasks. The AI reasoning and action breakdown are shown so users understand *why* a task is ranked first.

Focus Mode shows **today's pending tasks only** — it filters by `scheduled_for = today`. Tasks added without a scheduled date, or tasks carried over from previous days, will not appear here. To include a task in Focus Mode, ensure it has today's date as its scheduled date. The main dashboard shows all pending tasks regardless of date.

### Gmail Sync
Fetches up to 5 unread emails from the last 3 days where the subject contains action-oriented keywords (`action`, `urgent`, `deadline`, `review`, `feedback`, `approve`). Each email becomes a task, deduplicated by `gmail_message_id`. The sync requires explicit user authorization and only reads metadata (subject, sender, date) — email body content is not accessed.

> Note: Keyword-based subject filtering will produce false positives (marketing emails) and miss urgent emails with plain subjects. This is a known MVP limitation.

### Calendar Sync
Pulls calendar events from the next 48 hours and converts them to tasks. Event duration is mapped to `estimated_duration_mins`. Only events with a specific `dateTime` start (not all-day events) are imported.

### Drift Score
Measures the % of completed tasks that were low-value.
High drift = productive procrastination detected.

### Revenue Protection
Estimates income "protected" by completing high-value tasks today, based on your hourly rate. The rate is snapshotted at task creation time (`hourly_rate_at_creation`), so historical revenue figures remain accurate even if you update your rate later.

---

## MVP Scope — What's Included vs Excluded

| Included | Excluded |
|---|---|
| Google OAuth login | Email/password auth |
| Text + voice task input | Mobile app |
| Local deterministic task scoring | Long-term analytics |
| Gemini AI action breakdown (async) | Full email management |
| Gmail actionable email sync | Calendar editing |
| Google Calendar event sync | Team collaboration |
| Focus Mode (today's tasks) | Gantt charts / PM features |
| Daily stats (drift, revenue) | Billing / payments |
| Hourly rate configuration | Recurring tasks |

---

## Assumptions Being Tested (Phase 3)

1. **Seeing a high score motivates action** — Does the AI score actually change which task a user starts with?
2. **Voice input reduces friction** — Do users prefer speaking tasks over typing?
3. **Focus Mode reduces task-switching** — Does one-task-at-a-time improve completion of high-value work?
4. **Revenue framing creates urgency** — Does "$X revenue protected" motivate users more than a simple to-do list?

---

## Known Limitations

- Voice input requires Chrome (Web Speech API)
- Gmail sync only pulls emails with action keywords in the subject line — not perfect
- Scoring quality degrades for tasks without `estimated_value`, `due_date`, or `estimated_duration_mins`; provide these fields for best results
- Focus Mode only shows tasks scheduled for today — tasks from previous days must be rescheduled to appear
- No recurring tasks or long-term scheduling
- Cold start: AI scoring improves with more context but works from day 1
