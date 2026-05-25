// middleware.ts — Route protection + session refresh
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/auth/login', '/auth/forgot-password']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          )
        },
      },
    }
  )

  // getUser() validates JWT with Supabase Auth server and refreshes the session
  // cookie if needed. Must be called before any redirects so setAll() can run.
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r))

  // Not logged in → redirect to login
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Logged in + visiting login → redirect to dashboard.
  // Copy refreshed session cookies onto the redirect response so the browser
  // receives the updated token even through the redirect.
  if (user && isPublic) {
    const redirectRes = NextResponse.redirect(new URL('/dashboard', request.url))
    response.cookies.getAll().forEach(({ name, value }) =>
      redirectRes.cookies.set(name, value)
    )
    return redirectRes
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)'],
}
