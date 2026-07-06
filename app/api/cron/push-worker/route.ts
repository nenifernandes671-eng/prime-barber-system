import { NextRequest, NextResponse } from 'next/server'
import { processPushQueue } from '@/lib/server/push'

export const dynamic = 'force-dynamic'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return unauthorized()
  }

  const body = await req.json().catch(() => ({}))
  const limit = Math.min(Math.max(Number(body.limit || 25), 1), 100)
  const result = await processPushQueue(limit)
  return NextResponse.json(result)
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return unauthorized()
  }

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') || 25), 1), 100)
  const result = await processPushQueue(limit)
  return NextResponse.json(result)
}