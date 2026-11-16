import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16 discovers Proxy from src/ (same directory as src/app).
// Clerk must run on API routes before auth() executes inside route handlers.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Ignore static assets but keep app pages and Clerk callback endpoints.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run the Clerk proxy for protected API route handlers.
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
