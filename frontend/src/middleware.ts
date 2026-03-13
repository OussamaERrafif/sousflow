import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest } from 'next/server';

export default function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '');
  
  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isApiRoute = pathname.startsWith('/api');
  
  if (!token && !isAuthPage && !isApiRoute) {
    const loginUrl = new URL('/login', request.url);
    return Response.redirect(loginUrl);
  }
  
  if (token && isAuthPage) {
    const dashboardUrl = new URL('/ar', request.url);
    return Response.redirect(dashboardUrl);
  }
  
  return createMiddleware(routing)(request);
}

export const config = {
    matcher: ['/', '/(ar|fr)/:path*']
};
