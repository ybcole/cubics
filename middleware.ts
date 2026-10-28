import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

const publicRoutes = [
  "/sign-in",
  "/sign-up",
  "/sso-callback",
  "/_next",
  "/static",
  "/favicon.ico",
];

export default clerkMiddleware((auth, req) => {
  const { pathname } = req.nextUrl;

  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
