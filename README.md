# Cubics

Desktop collaborative canvas app for embedding external websites, live screens, and tools on an infinite whiteboard. Live and shared tabs stream via WebRTC for real-time collaboration.

Built with Electron + Next.js. Browser widgets use Chromium guests; individual sites may still restrict DRM, sign-in or capture. The final architecture will separate native browser sessions from visual canvas widgets.

## Final-product delivery plan

Cubics has a [final target architecture and 25-milestone delivery plan](master_plan.md), an exact [master checklist](master_checklist.md), and a [product/technical contract index](docs/final-product/README.md). The plan describes **target behavior, not functionality already shipped**. Milestone completion is evidence-gated, and the architecture is intended to stabilize at GA rather than undergo recurring rewrites. For major changes use [ADRs](docs/adr/README.md) and the [change governance policy](docs/final-product/governance.md).

## Features

- **Infinite Canvas** — 100,000×100,000px workspace with pan and zoom (0.1x–5x)
- **Any Website Widgets** — sites load in sandboxed Chromium webviews; frame-blocking headers don't apply
- **Persistent Logins** — cookies persist across restarts via a real browser session
- **Live Tab / Screen Share** — native screen & window capture
- **Popups Become Widgets** — links opened in new tabs spawn canvas widgets instead
- **Library** — save and organize widgets for reuse across rooms
- **Rooms** — create spaces for different projects or teams

## Tech Stack

- **Shell:** Electron 45 (main process spawns the Next.js server, manages sessions & permissions)
- **Frontend:** Next.js 16, React 18, Tailwind CSS, TypeScript
- **Database:** Supabase PostgreSQL (via Prisma)
- **Auth:** Clerk
- **Canvas:** react-rnd for drag/resize, CSS transforms for zoom

## Setup

### 1. Clone and install

```bash
git clone https://github.com/ybcole/cubics.git
cd cubics
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Required:
- `DATABASE_URL` — Supabase PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key
- `CLERK_SECRET_KEY` — Clerk secret key

### 3. Database

```bash
npx prisma db push
```

### 4. Run the desktop app (development)

```bash
npm run app:dev
```

Starts `next dev` on port 3000 and opens the Cubics window once it's ready.

You can still run the UI in a plain browser during development with `npm run dev`, but external-site embedding requires the desktop app.

## Troubleshooting Clerk sign-in redirects

If you see `Clerk: Refreshing the session token resulted in an infinite redirect loop`:

1. Open the **same development instance** in the [Clerk Dashboard](https://dashboard.clerk.com/) and recopy **both** keys into your local `.env`: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...` and `CLERK_SECRET_KEY=sk_test_...`. Do not commit real keys. The startup check rejects missing, placeholder, mixed test/live, and localhost-incompatible production keys, but it **cannot** detect keys from two different development instances.
2. Use `NEXT_PUBLIC_SITE_URL=http://localhost:3000` for local development. Electron now opens the same `localhost` hostname rather than `127.0.0.1`; cookies and authentication handshakes depend on the hostname. If overriding `CUBICS_SERVER_URL`, keep the host consistent.
3. Restart `npm run app:dev` after changing `.env`. Rebuild packaged apps after changing Clerk keys, because Next.js embeds the publishable key during the build.
4. If the keys were changed and the error persists, try a fresh, isolated Electron session without deleting the original session: `CUBICS_PROFILE=clerk-clean npm run app:dev`. If that works, clear stale Clerk cookies/site data in the original Electron profile. Verify that your computer's clock is accurate.

Run the offline config tests with `node --test scripts/validate-clerk-env.test.js`.

## Packaging

```bash
npm run app:dist      # build shell-only macOS installer (requires a verified public HTTPS host)
npm run app:start     # alias for local development workflow (npm run app:dev)
```

Current local development: `next build` produces a standalone Node server (`.next/standalone`). `scripts/prepare-standalone.js` copies public assets and **removes** any root `.env*` files; it no longer copies credentials. During development Electron can load local environment settings and spawn that server. The privileged local server is a **temporary legacy architecture**—not a safe public installer.

> **Release gate:** `CUBICS_DESKTOP_APP_URL=https://your-real-https-host npm run app:dist` builds a shell-only installer with a pinned HTTPS origin. CI verifies no privileged backend code or secrets enter the extracted Electron app; actual live staging deployment, authenticated tests, signed release and rollback verification are still required before public distribution.

## Project Structure

```
cubics/
├── electron/
│   ├── main.js           # App lifecycle, window, embedded server, sessions
│   └── preload.js        # Renderer bridge (window.cubics)
├── scripts/
│   └── prepare-standalone.js
├── prisma/
│   └── schema.prisma     # Database schema
├── src/
│   ├── app/              # Next.js app router
│   ├── components/       # React components (WidgetFrame renders webviews)
│   ├── lib/              # Utilities
│   └── types/            # TypeScript types
├── docs/
│   └── BRAND.md          # Brand master sheet (source of truth for UI)
├── electron-builder.yml  # Packaging config
└── next.config.js
```

## How Embedding Works

Widget sites render in Electron `<webview>` tags (guest Chromium instances):

- `X-Frame-Options` / CSP `frame-ancestors` are irrelevant — webviews are top-level frames. The main process additionally strips those headers from all non-app responses.
- Navigation events (`did-navigate`) sync each widget's URL back to the database.
- `setWindowOpenHandler` intercepts popups and forwards them to the renderer, which spawns a new widget.
- Screen capture uses `setDisplayMediaRequestHandler` + `desktopCapturer`.

## Database Schema

- **User** — clerk user ID, email, name
- **Room** — workspace with name, owner, members
- **RoomMember** — user-room relationship with role
- **Widget** — iframe/tab with position (x, y), size (w, h), URL, title

## Design System

All UI follows the master sheet in [`docs/BRAND.md`](docs/BRAND.md). Run `npm run brand:check` to catch off-brand classes.

## Scripts

```bash
npm run app:dev      # Dev: Next dev server + Electron window
npm run app:dist     # shell-only installer; configure CUBICS_DESKTOP_APP_URL
npm run dev          # Web-only dev server (no embedding)
npm run build        # Production Next build
npm run typecheck    # TypeScript check
npm run brand:check  # Fail on classes that aren't in docs/BRAND.md
npx prisma db push   # Push schema to database
npx prisma migrate   # Run migrations
```

## License

MIT

## Live & shared tabs (streaming architecture)

Video goes through a LiveKit SFU instead of a WebRTC mesh, so the host encodes once no matter how many people watch.

```bash
# dev: run a local SFU (https://docs.livekit.io/home/self-hosting/local/)
livekit-server --dev        # ws://127.0.0.1:7880, key "devkey", secret "secret"
```

Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in `.env` (LiveKit Cloud works too).

- **Host:** Chromium tab capture of the webview -> one simulcast track (3 layers). Capture only runs while someone is watching.
- **Viewer:** a tab is subscribed only while it is on screen and inside the decode budget (`src/lib/live/budget.ts`: `MAX_LIVE` full-quality, `MAX_LOW` lowest-layer, the rest show their last frame). Requested resolution follows on-screen size, including zoom.
- **Signalling:** a single socket per client (`src/lib/live/hub.ts`) carries host state, viewer counts and shared-tab input.

## Free-first deployment target (ADR-0008)

**Personal non-commercial development:** Vercel Hobby (Next.js API/UI), Supabase Free (PostgreSQL + private Realtime), Clerk Free (identity), LiveKit Free (media); local personal browser tabs remain in Electron. For commercial use upgrade Vercel to Pro, and use the same Supabase/Clerk/LiveKit projects on higher plans as quotas require. [Migration/runbook](docs/final-product/free-first-hosting.md) · [ADR-0008](docs/adr/0008-free-first-upgrade-path.md).

The existing Socket.IO service still drives the app while private Supabase Realtime/RLS + Clerk authentication and media/control parity are tested behind a flag. No Vercel deployment is claimed. The populated Supabase project is not a staging playground; Railway staging remains a separate legacy resource which may consume credits and must not be deleted without approval.

### Electron security and native validation

M04's sandboxed main window, no-Node guest webviews, verified account-scoped partitions, narrow preload, native
permission prompts and HTTPS URL policy are recorded in [M04 evidence](docs/milestones/M04.md).
Hostile-site native CI runs on Linux, macOS and Windows. A green source-level
security workflow does **not** replace an OS permission, profile isolation and
signed-update test. Do not claim the native milestone complete while its E2E
or platform sign-off remains open. Account partition names are now issued by Electron after `/v1/identity` verification; complete Clerk-cookie and two-account tests remain required.

### Local browser privacy (M05)

On Electron desktop, Personal browser sessions remain device-local and persistent for the verified Cubics account. Live uses the existing separately scoped host partition. Shared tabs now start in a **temporary cookie jar**, with no implicit use of Personal or Live credentials. Personal and Shared tab headers include a native-confirmed local browser-data clear action. This does **not** delete a Cubics account, server-side room records, saved download files, or other people's browsing profiles. [Browser-mode contract](docs/final-product/browser-modes.md) and [M05 evidence](docs/milestones/M05.md) describe limitations and outstanding OS/privacy checks.

### LiveKit participant revocation and private metadata (M05)

The server now uses room-scoped opaque LiveKit identities and a signed `/api/livekit/webhook` endpoint to recheck participant membership on join. **You must configure this webhook separately in LiveKit Cloud or self-hosted LiveKit**; merely merging this endpoint does not enable webhook delivery. [Webhook setup and acceptance](docs/deployment/livekit-webhook.md).

Previously synced Personal/Live URLs and titles may still exist in PostgreSQL. The new `npm run security:browser-metadata-audit` tool returns privacy exposure **counts only** without modifying or printing customer data. An OS-protected device-local navigation migration is still required before any legacy cloud scrub. [M05 evidence](docs/milestones/M05.md).
