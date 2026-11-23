// middleware.ts — Offline mode: no auth required, just pass through
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)'],
}
