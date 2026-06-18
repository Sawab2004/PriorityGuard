import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  // Auth optional — allow anonymous feedback, but attach user_id if logged in
  let body: { disappointment: string; recommend: number; comment?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { disappointment, recommend, comment } = body

  if (!disappointment || !recommend) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const validDisappointment = ['very', 'somewhat', 'not']
  if (!validDisappointment.includes(disappointment)) {
    return NextResponse.json({ error: 'Invalid disappointment value' }, { status: 400 })
  }

  if (recommend < 1 || recommend > 5) {
    return NextResponse.json({ error: 'Invalid recommend value' }, { status: 400 })
  }

  const { error } = await supabase
    .from('feedback')
    .insert({
      user_id: session?.user?.id ?? null,
      disappointment,
      recommend,
      comment: comment?.trim().slice(0, 1000) || null,
    })

  if (error) {
    console.error('Feedback insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}