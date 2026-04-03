import { NextRequest, NextResponse } from 'next/server';
import { scoreTaskWithAI } from '@/lib/ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Default mock profile
    const profile = { hourly_rate: 85, work_start_hour: 9, work_end_hour: 17 };
    
    const result = await scoreTaskWithAI({
      title: body.title,
      description: body.description,
      due_date: body.due_date,
      estimated_value: body.estimated_value,
    }, profile, []);
    
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
