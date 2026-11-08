# Vercel free-first deployment

**Status:** configuration only; Vercel project/account is not connected here.
Import `ybcole/cubics` as a personal Hobby project for **non-commercial development only**. Set framework Next.js, root directory `.`, and use the checked-in `vercel.json` build command (`npx prisma generate && npm run build`). The Next API routes stay server-only; no Railway/Socket.IO service is required by the **target** architecture.

Build/runtime:
- Public: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Protected: `DATABASE_URL` (Supabase pooled PostgreSQL), `CLERK_SECRET_KEY`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- Set Clerk OAuth callbacks to the actual deployment URL and configure Supabase Clerk third-party auth.
- Keep `NEXT_PUBLIC_CUBICS_REALTIME_PROVIDER` in its legacy mode until RLS, adapter, room operations, media/control and revocation parity are tested. Never publish a `service_role` key or use a client Broadcast as a widget database commit.
- Do not run the old SQLite migration on Supabase, reset a populated DB, or set Railway Postgres as the default; see ADR-0007.
- Commercial product use requires Vercel Pro, even if traffic is below Hobby quotas.

To move to paid plans: upgrade the **same** Vercel, Supabase, Clerk and LiveKit projects, preserve room IDs/Prisma migrations and verify quota increases. No automatic infrastructure recreation is required. See [ADR-0008](../docs/adr/0008-free-first-upgrade-path.md) for fallback and rollback.
