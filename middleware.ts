import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Auth-Id, X-Auth-Role, X-Auth-Email',
  'Access-Control-Max-Age': '86400',
};

function addCorsHeaders(response: NextResponse) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Add CORS headers to API responses
  if (pathname.startsWith('/api/')) {
    return addCorsHeaders(NextResponse.next());
  }

  const isLoggedIn = request.cookies.get('isLoggedIn')?.value;
  const userRole = request.cookies.get('userRole')?.value;

  const publicPaths = ['/login', '/register', '/api/login', '/api/register'];
  
  if (publicPaths.includes(pathname)) {
    return addCorsHeaders(NextResponse.next());
  }

  // Role-based restrictions for Employees
  if (isLoggedIn === 'true' && userRole === 'EMPLOYEE') {
    const restrictedPaths = [
      '/accounting',
      '/asset-inventory',
      '/users',
      '/employees',
      '/reports',
      '/settings',
    ];

    if (restrictedPaths.some(path => pathname === path || pathname.startsWith(path + '/'))) {
      return addCorsHeaders(NextResponse.redirect(new URL('/dashboard', request.url)));
    }
  }

  if (!isLoggedIn && pathname !== '/login' && pathname !== '/register') {
    return addCorsHeaders(NextResponse.redirect(new URL('/login', request.url)));
  }

  return addCorsHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
