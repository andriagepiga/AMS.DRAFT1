import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  console.log('Middleware - checking auth for path:', req.nextUrl.pathname)

  // Refresh session if exists
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    console.error('Middleware - session error:', sessionError)
  }

  // Protected routes that require authentication
  const protectedPaths = ['/staff', '/admin']
  const isProtectedPath = protectedPaths.some(path => req.nextUrl.pathname.startsWith(path))

  console.log('Middleware - is protected path:', isProtectedPath)
  console.log('Middleware - has session:', !!session)

  // If accessing protected route without session, redirect to login
  if (isProtectedPath && !session) {
    console.log('Middleware - redirecting to login')
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/'
    redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // For authenticated users, verify role-based access
  if (session) {
    try {
      // Get user's role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('username', session.user.email?.replace('@example.com', ''))
        .single()

      if (userError || !userData) {
        throw new Error('Failed to fetch user role')
      }

      // Check admin access
      if (req.nextUrl.pathname.startsWith('/admin') && userData.role !== 'admin') {
        console.log('Middleware - unauthorized admin access attempt')
        // Redirect non-admin users to staff dashboard
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.pathname = '/staff/dashboard'
        return NextResponse.redirect(redirectUrl)
      }

      // Check staff access
      if (req.nextUrl.pathname.startsWith('/staff') && userData.role !== 'staff') {
        // Redirect non-staff users to admin dashboard
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.pathname = '/admin/dashboard'
        return NextResponse.redirect(redirectUrl)
      }
    } catch (error) {
      console.error('Error in middleware:', error)
      // On error, redirect to login
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/'
      return NextResponse.redirect(redirectUrl)
    }
  }

  return res
}

// Specify which routes to run the middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
} 