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

/**
 * Creates an OAuth2 client with automatic token refresh.
 *
 * Google access tokens expire after 1 hour. Previously, expired tokens caused
 * silent failures in Gmail and Calendar sync. Now, when the client detects an
 * expired token it automatically fetches a new one using the refresh token and
 * calls `onTokenRefresh` so the caller can persist the new credentials.
 *
 * @param accessToken   Current stored access token
 * @param refreshToken  Stored refresh token (long-lived)
 * @param onTokenRefresh  Called with new tokens when a refresh occurs
 */
function createAuthenticatedClient(
  accessToken: string,
  refreshToken: string,
  onTokenRefresh?: (newAccessToken: string, expiryDate: number) => Promise<void>
) {
  const oauth2Client = getGoogleOAuthClient()

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  // Listen for token refresh events emitted by the Google client library
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token && onTokenRefresh) {
      const expiry = tokens.expiry_date ?? Date.now() + 3600 * 1000
      console.log('[google.ts] Token refreshed, persisting new access token.')
      await onTokenRefresh(tokens.access_token, expiry)
    }
  })

  return oauth2Client
}

export async function fetchGmailTasks(
  accessToken: string,
  refreshToken: string,
  onTokenRefresh?: (newAccessToken: string, expiryDate: number) => Promise<void>
): Promise<GmailTask[]> {
  try {
    const oauth2Client = createAuthenticatedClient(accessToken, refreshToken, onTokenRefresh)
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
  } catch (err: any) {
    // Surface auth errors clearly so callers can prompt re-authentication
    if (err?.code === 401 || err?.message?.includes('invalid_grant')) {
      console.error('[google.ts] Gmail auth error — refresh token may be revoked. User must re-authenticate.')
      throw new Error('GOOGLE_AUTH_EXPIRED')
    }
    console.error('Gmail fetch error:', err)
    return []
  }
}

export async function fetchCalendarTasks(
  accessToken: string,
  refreshToken: string,
  onTokenRefresh?: (newAccessToken: string, expiryDate: number) => Promise<void>
): Promise<CalendarTask[]> {
  try {
    const oauth2Client = createAuthenticatedClient(accessToken, refreshToken, onTokenRefresh)
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
  } catch (err: any) {
    if (err?.code === 401 || err?.message?.includes('invalid_grant')) {
      console.error('[google.ts] Calendar auth error — refresh token may be revoked. User must re-authenticate.')
      throw new Error('GOOGLE_AUTH_EXPIRED')
    }
    console.error('Calendar fetch error:', err)
    return []
  }
}