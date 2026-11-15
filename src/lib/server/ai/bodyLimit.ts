import { NextResponse } from 'next/server'

/** Refuses an upload its own content-length says is over the cap, before any of it is read. A missing length is left to the caller's post-read check. */
export function tooLargeByHeader(req: Request, maxBytes: number): NextResponse | null {
  return Number(req.headers.get('content-length')) > maxBytes ? NextResponse.json({ error: 'Request too large' }, { status: 413 }) : null
}
