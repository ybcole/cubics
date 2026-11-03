# Chat Attachments & Scalability Plan

## Context

Cubics is a collaborative spatial canvas with chat per room. Chat is currently:
- In-memory only (`roomChat` Map in `socket-server.cjs`, last 200 messages). Not persisted.
- Text-only (`content: string`). `imageUrl` field exists (user avatar) but no attachments.
- Avatars/images stored as base64 data URLs in Postgres (Supabase free tier, 500MB DB, 1GB storage, 2GB egress/month).
- Socket server is a single Node process; LiveKit SFU for tab streams.

## Goal

Support sending images/files in chat without breaking the free-tier DB, and provide a realistic scalability/workaround plan.

## Decisions

1. **Do NOT store file bytes in Postgres.** Use Supabase Storage (1GB free) for attachments; store only the public URL in chat messages.
2. **Persist chat to DB** (new `ChatMessage` table) so history survives restarts, with a cap (last 200 per room) and TTL cleanup.
3. **Upload path**: client → `/api/chat/upload` → Supabase Storage → returns URL → emit `chat:send` with `{ content, attachments: [{ url, name, type, size }] }`.
4. **Size limits**: max 5MB per file, max 3 attachments per message, images only initially (png/jpg/webp/gif). PDFs optional later.
5. **Compression**: client-side image resize to max 1280px width before upload (canvas toBlob) to save storage/egress.
6. **Real-time**: keep socket broadcast; persist async (don't block emit).

## Schema addition

```prisma
model ChatMessage {
  id        String   @id @default(cuid())
  roomId    String
  userId    String?
  userName  String
  content   String   @default("")
  attachments Json?   // [{ url, name, type, size }]
  createdAt DateTime @default(now())
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user      User?    @relation(fields: [userId], references: [id])
}
```

Add `chatMessages ChatMessage[]` to Room. Run `prisma migrate dev`.

## Scalability assessment (free tier)

Realistic free-tier capacity (Supabase + single Node socket + LiveKit dev):
- **DB**: 500MB. With avatars as data URLs (~50KB each) and metadata, ~5k-10k users before DB fills. With attachments in Storage (not DB), DB stays small.
- **Storage**: 1GB. ~200-500 images at 2-5MB. Needs cleanup/TTL.
- **Egress**: 2GB/month. LiveKit tab streams dominate. Chat images add load. Limit image sizes.
- **Socket server**: single process, in-memory. ~50-100 concurrent users before CPU/memory strain. LiveKit SFU adds more.
- **LiveKit free**: limited minutes; self-hosted dev server on one machine = single point.

Conclusion: free tier handles small teams (tens of users, a few rooms). Not hundreds. For growth, paid tiers or self-hosted infra needed.

## Workarounds for free-tier limits

1. **Offload files to Supabase Storage** (not DB) — biggest win.
2. **Image compression client-side** before upload (max 1280px, quality 0.8).
3. **TTL cleanup**: cron job to delete attachments older than 30 days; keep chat text longer.
4. **Lazy-load images** in chat (IntersectionObserver).
5. **Cap history**: keep last 200 messages per room in DB; prune older.
6. **Optional self-host**: run socket server + LiveKit on a cheap VPS (not free tier) when scaling.
7. **CDN for avatars**: store avatars in Storage too, not base64 in DB.

## Implementation steps

1. Add `ChatMessage` model + migration.
2. Create `/api/chat/upload` route: auth check, validate file (type/size), upload to Supabase Storage bucket `chat-attachments`, return `{ url }`. Requires `@supabase/supabase-js` and env vars `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Update socket `chat:send` to accept `attachments` array; persist to DB (async, don't block emit); include in broadcast.
4. Update `ChatMessage` interface in `src/app/spaces/[id]/page.tsx` to add `attachments`.
5. Update `ChatLine` to render image attachments (img with lazy loading) and file links.
6. Add file picker button in chat composer; on select, upload, then append URL to pending message; send.
7. Add history load from DB on room join (socket `chat:history` already sends in-memory; switch to DB query).
8. Add cleanup cron (optional, separate deploy).

## Risks

- Supabase free storage 1GB fills fast with images; enforce size limits and TTL.
- Base64 avatars in DB already consume space; migrating to Storage is a separate task.
- Socket server single process = single point of failure; for scale, use Redis adapter.
- LiveKit self-hosted on dev machine can't handle many concurrent streams.

## Validation

- Upload image in chat; verify it persists across refresh and appears for other users.
- Check DB size doesn't grow with file bytes (only URLs).
- Test with 5MB file rejection.
- Run typecheck + brand check.

## Out of scope

- Video/audio attachments, large files, end-to-end encryption, mobile push.
