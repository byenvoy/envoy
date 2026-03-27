import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const path = request.nextUrl.pathname;

  const isAuthRoute = path.startsWith("/login") || path.startsWith("/signup");
  const isDashboardRoute =
    path.startsWith("/onboarding") ||
    path.startsWith("/knowledge-base") ||
    path.startsWith("/inbox") ||
    path.startsWith("/playground") ||
    path.startsWith("/settings") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/autopilot");

  // Redirect unauthenticated users to login
  if (!sessionCookie && isDashboardRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth routes
  if (sessionCookie && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/knowledge-base";
    return NextResponse.redirect(url);
  }

  // Note: onboarding redirect is handled in the dashboard layout
  // (server component) where we can query the database via Drizzle.

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
