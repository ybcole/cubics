# Cubics

Desktop collaborative canvas app for embedding external websites, live screens, and tools on an infinite whiteboard.

Built with Electron + Next.js — every widget runs in its own Chromium webview, so any site embeds without extensions or header workarounds.

## Features

- **Infinite Canvas** — 100,000×100,000px workspace with pan and zoom (0.1x–5x)
- **Any Website Widgets** — sites load in sandboxed Chromium webviews; frame-blocking headers don't apply
- **Persistent Logins** — cookies persist across restarts via a real browser session
- **Live Tab / Screen Share** — native screen & window capture
- **Popups Become Widgets** — links opened in new tabs spawn canvas widgets instead
- **Library** — save and organize widgets for reuse across rooms
- **Rooms** — create spaces for different projects or teams

## Tech Stack

- **Shell:** Electron 43 (main process spawns the Next.js server, manages sessions & permissions)
- **Frontend:** Next.js 14, React 18, Tailwind CSS, TypeScript
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

## Packaging

```bash
npm run app:dist      # builds Next standalone server + macOS dmg/zip into release/
npm run app:start     # build + launch packaged-style from local files
```

How it works: `next build` produces a standalone Node server (`.next/standalone`). `scripts/prepare-standalone.js` copies static assets and `.env` into it, then electron-builder ships it under the app's resources. On launch, the Electron main process picks a free port, spawns the server using Electron's own binary (`ELECTRON_RUN_AS_NODE=1`), waits for it to respond, and loads the window.

> Note: shipping `.env` inside the app bakes your keys into the bundle. For public distribution, move secrets behind a hosted backend first.

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

## Scripts

```bash
npm run app:dev      # Dev: Next dev server + Electron window
npm run app:dist     # Package macOS dmg/zip into release/
npm run dev          # Web-only dev server (no embedding)
npm run build        # Production Next build
npm run typecheck    # TypeScript check
npx prisma db push   # Push schema to database
npx prisma migrate   # Run migrations
```

## License

MIT
