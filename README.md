# 🛡 PriorityGuard

**AI-powered cognitive prioritization for freelancers.**
Stop wasting your peak hours on $15/hr tasks.

*demo video: https://drive.google.com/file/d/1qG-b267rg6lfbGsf9ZoxSOoMkIQ2CmM6/view?usp=drive_link*

---

## What It Does

It helps solopreneurs and freelancers protect their peak cognitive hours by automatically scoring and prioritizing tasks by economic value, urgency, and cognitive effort.

**Core user flow:**
1. Sign in with Google
2. Add tasks via text or voice
3. Tasks are instantly scored (0–100) using a deterministic weighted formula across revenue impact, deadline urgency, and cognitive effort
4. A background Gemini call enriches each task with a 3-step action breakdown and category label (non-blocking)
5. Dashboard shows tasks ranked by score — highest value first
6. Focus Mode: one task at a time, distraction-free
7. Low-impact tasks can be delegated — Gemini generates a VA-ready brief
8. A floating AI coach answers questions about what to work on next
9. Sync tasks from Gmail (action emails) and Google Calendar events
10. In-app feedback widget for MVP testing (Sean Ellis test + free text)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend & API | Next.js 14 (App Router) |
| Database & Auth | Supabase (PostgreSQL + Google OAuth) |
| Task Scoring | Deterministic weighted formula (local, no API) |
| AI Enrichment, Chat, Delegation | Google Gemini 1.5 Flash (async where possible) |
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

Create a `.env.local` file in the project root:

```env
# Supabase (required for auth and database)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Google OAuth (for login)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret

# Google APIs (for Gmail & Calendar sync)
GOOGLE_API_KEY=your_api_key_here

# AI Enrichment, Chat Coach, Delegation Briefs (optional — falls back to static templates if unset)
GEMINI_API_KEY=your_gemini_api_key
```

> **Note:** Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required to get started. Without `SUPABASE_SERVICE_ROLE_KEY`, background AI enrichment writes will silently fail RLS checks. Without `GEMINI_API_KEY`, scoring still works locally, and chat/delegate fall back to static templates.

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to your project → **SQL Editor**
3. Run the entire contents of `supabase-schema.sql`
4. Run `feedback-migration.sql` as well (adds the feedback table for MVP testing)
5. Go to **Project Settings → API** and copy your Project URL, Anon Key, and Service Role Key into `.env.local`
6. Go to **Authentication → Providers → Google** and enable it, pasting your Google OAuth credentials

### 4. Set up Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create or select a project
3. Enable: **Gmail API**, **Google Calendar API**, **Google+ API**
4. Go to **Credentials → Create OAuth 2.0 Client ID** (Web application)
5. Add these Authorized redirect URIs:
   ```
   http://localhost:3000/api/auth/callback
   https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback
   ```
6. Copy Client ID and Secret to `.env.local`

### 5. Run the app

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Deployment to Vercel

1. Import the repo at [vercel.com](https://vercel.com)
2. Add all `.env.local` variables under Project Settings → Environment Variables
3. In Supabase → Authentication → URL Configuration, add your Vercel domain:
   ```
   https://YOUR_VERCEL_DOMAIN.vercel.app/api/auth/callback
   https://YOUR_VERCEL_DOMAIN.vercel.app/**
   ```
4. In Google Cloud Console, add the same Vercel callback URL to Authorized redirect URIs
5. Deploy and test the Google login flow in production

> ⚠️ **Known gap:** there is currently no `middleware.ts` refreshing the Supabase session cookie on the server. This means server-rendered pages and API routes can see a stale or missing session even when the browser client is authenticated. See the full audit below for details and fix priority.

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── tasks/              # GET (list), POST (create + score)
│   │   │   └── [id]/           # PATCH (update status), DELETE
│   │   ├── ai/
│   │   │   ├── chat/           # POST — floating coach chat
│   │   │   ├── delegate/       # POST — generates VA delegation brief
│   │   │   └── scrum/          # GET — daily briefing (used by DailyScrum)
│   │   ├── feedback/           # POST — MVP feedback capture
│   │   ├── gmail/               # POST (sync Gmail → tasks)
│   │   ├── calendar/            # POST (sync Calendar → tasks)
│   │   └── auth/
│   │       ├── callback/        # Supabase OAuth callback
│   │       └── google/callback/ # Google Gmail/Calendar OAuth
│   ├── dashboard/               # Main dashboard page
│   ├── focus/                   # Focus mode (one task at a time)
│   ├── login/                   # Login page
│   └── globals.css
├── components/
│   ├── TaskCard.tsx             # Individual task with score, actions, delegation
│   ├── AddTaskForm.tsx          # Text + voice task input
│   ├── StatsBar.tsx             # Daily stats (revenue protected, drift)
│   ├── RevenueAudit.tsx         # Revenue at risk / opportunity cost sidebar
│   ├── IntegrationPanel.tsx     # Gmail/Calendar sync controls
│   ├── ChatCoach.tsx            # Floating AI chat coach
│   ├── DailyScrum.tsx           # Daily strategy briefing modal
│   └── FeedbackSection.tsx      # MVP feedback widget
├── lib/
│   ├── ai.ts                    # Scoring engine (local) + Gemini enrichment
│   ├── google.ts                # Gmail + Calendar API
│   ├── supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   └── server.ts            # Server + admin Supabase clients
│   └── utils.ts                 # Helpers, formatters
└── types/
    └── index.ts                 # TypeScript types    
```

---

## Key Features

### Task Scoring — Two-Tier Pipeline

**Tier 1 — Local scoring (synchronous, always runs):**
`calculateTaskScoreLocal` computes a weighted score using three dimensions:

- **Impact** (50%): Compares the task's implied hourly rate against your configured hourly rate using a logarithmic scale (no longer capped at 80 — a task worth 4x your rate can reach 100). Tasks with no `estimated_value` fall back to a 4-tier keyword classifier (critical/high/medium/low/unknown), with an unknown baseline of 42 rather than a near-bottom 30.
- **Urgency** (30%): Uses a smooth exponential decay curve based on `due_date` proximity instead of hard brackets, so a task due in 1h59m and 2h01m no longer score 15 points apart. Tasks with no due date fall back to title-keyword urgency detection.
- **Effort** (20%, inverse): Shorter tasks score higher, rewarding quick wins. Weight raised from 15% to make this dimension actually move the ranking.

The task is **inserted immediately** with these scores — task creation is never blocked by an API call.

**Tier 2 — Gemini enrichment (asynchronous, best-effort):**
After the `201` response is sent, a background call to Gemini 1.5 Flash generates a 3-step action breakdown and categorizes the task as `High-Impact`, `Low-Impact Administrative`, or `Procrastination Trap`. If Gemini is unavailable, a static fallback is used.

### AI Coach (Chat)
A floating chat widget backed by Gemini. Authenticated, rate-limited to the last 20 messages of context, and uses Gemini's native chat history API rather than hand-built prompt strings. Falls back to a graceful in-character message if Gemini errors, rather than leaking raw error text into the conversation.

### Task Delegation
Low-impact or procrastination-trap tasks can be delegated — Gemini generates a copy-paste-ready brief (context, action steps, success criteria) for a VA. Verifies task ownership before generating, and falls back to a template brief if no Gemini key is configured.

### Voice Input
Browser-native Web Speech API. Works best in Chrome. Tasks created via voice are now correctly tagged with `source: 'voice'` in the database (previously always saved as `'manual'` due to a state-timing bug).

### Focus Mode
Distraction-free, one task at a time. Currently shows **all pending tasks** regardless of scheduled date (changed from the original "today only" filter — confirm this matches your intended product behavior, since it's a deviation from the original MVP spec).

### Gmail Sync
Fetches up to 5 unread emails from the last 3 days with action-oriented subject keywords. Deduplicated by `gmail_message_id`. Reads metadata only, not email body.

### Calendar Sync
Pulls events from the next 48 hours with a specific `dateTime` start (not all-day events).

### Drift Score & Revenue Protected
**Revenue Protected** estimates the dollar value of work completed *today* (now correctly filtered by `completed_at` date — previously could include all-time history). **Drift Score** measures what % of completed tasks were low-value, surfacing "productive procrastination."

### Feedback Widget
A Sean Ellis-style MVP feedback form ("How disappointed would you be if this disappeared?" + recommend likelihood + free text), stored in a dedicated `feedback` table with RLS allowing anonymous submission.

---

## MVP Scope — What's Included vs Excluded

| Included | Excluded |
|---|---|
| Google OAuth login | Email/password auth |
| Text + voice task input | Mobile app |
| Local deterministic task scoring | Long-term analytics |
| Gemini AI action breakdown (async) | Full email management |
| Gemini-powered chat coach | Calendar editing |
| Gemini-powered task delegation briefs | Team collaboration |
| Gmail actionable email sync | Gantt charts / PM features |
| Google Calendar event sync | Billing / payments |
| Focus Mode | Recurring tasks |
| Daily stats (drift, revenue) | Server-side session refresh middleware |
| Hourly rate configuration | |
| In-app feedback capture | |

---

## Known Limitations

- **No `middleware.ts`** — the Supabase session cookie is not refreshed server-side on every request. This is the most likely root cause of intermittent "signed in on client, 401 on server" bugs, including the original Vercel sign-in issue. See the architecture audit for the fix.
- Two Supabase auth packages exist in the ecosystem (`@supabase/auth-helpers-nextjs`, used here, vs the newer `@supabase/ssr`). The app is internally consistent on `auth-helpers-nextjs`, but this package is in maintenance mode upstream — worth planning a migration.
- Voice input requires Chrome (Web Speech API)
- Gmail sync only pulls emails with action keywords in the subject line — not perfect
- Scoring quality still benefits from `estimated_value`, `due_date`, and `estimated_duration_mins`, though unscored tasks are now meaningfully differentiated by title keywords rather than collapsing to one value
- The "Notion / Todoist / ClickUp" connect buttons in IntegrationPanel are currently non-functional UI placeholders that simulate a sync with `setTimeout` — recommend removing before user testing to avoid false bug reports
- No recurring tasks or long-term scheduling
- Cold start: AI scoring improves with more context but works from day 1