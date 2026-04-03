import { google } from 'googleapis'
import { GmailTask, CalendarTask } from '@/types'

export function getGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  )
}

export function getGoogleAuthUrl() {
  const oauth2Client = getGoogleOAuthClient()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
  })
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = getGoogleOAuthClient()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

export async function fetchGmailTasks(
  accessToken: string,
  refreshToken: string
): Promise<GmailTask[]> {
  try {
    const oauth2Client = getGoogleOAuthClient()
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Fetch emails with action-required keywords in subject
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread (subject:action OR subject:urgent OR subject:deadline OR subject:review OR subject:feedback OR subject:approve) newer_than:3d',
      maxResults: 10,
    })

    if (!res.data.messages) return []

    const tasks: GmailTask[] = []

    for (const msg of res.data.messages.slice(0, 5)) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      })

      const headers = detail.data.payload?.headers || []
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No subject'
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown sender'
      const date = headers.find(h => h.name === 'Date')?.value

      tasks.push({
        gmail_message_id: msg.id!,
        title: `Reply: ${subject}`,
        description: `From: ${from}`,
        due_date: date ? new Date(date).toISOString() : null,
      })
    }

    return tasks
  } catch (err) {
    console.error('Gmail fetch error:', err)
    return []
  }
}

export async function fetchCalendarTasks(
  accessToken: string,
  refreshToken: string
): Promise<CalendarTask[]> {
  try {
    const oauth2Client = getGoogleOAuthClient()
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 2)

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: tomorrow.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 10,
    })

    const events = res.data.items || []

    return events
      .filter(e => e.summary && e.start?.dateTime)
      .map(e => ({
        calendar_event_id: e.id!,
        title: e.summary!,
        description: e.description || null,
        due_date: e.start!.dateTime!,
        estimated_duration_mins: e.end?.dateTime
          ? Math.round(
              (new Date(e.end.dateTime).getTime() - new Date(e.start!.dateTime!).getTime()) /
              60000
            )
          : null,
      }))
  } catch (err) {
    console.error('Calendar fetch error:', err)
    return []
  }
}
