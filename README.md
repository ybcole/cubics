# Cubics

Collaborative canvas web app for embedding external websites, live tabs, and tools on an infinite whiteboard.

## Features

- **Infinite Canvas** — 100,000×100,000px workspace with pan and zoom (0.1x–5x)
- **External Website Widgets** — embed any website in iframes with auto sign-in using existing browser sessions
- **Live Tab** — share your current browser tab as a widget
- **Library** — save and organize widgets for reuse across rooms
- **Rooms** — create spaces for different projects or teams
- **Chrome Extension** — strips frame-blocking headers so sites load in iframes

## Tech Stack

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

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Chrome Extension (required for external widgets)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `cubics-companion` folder
4. Go to `chrome://settings/cookies` → set **Third-party cookies** to **Allow third-party cookies**

See [cubics-companion/README.md](cubics-companion/README.md) for details.

## Project Structure

```
cubics/
├── cubics-companion/    # Chrome extension
│   ├── manifest.json    # Extension config
│   ├── rules.json       # Header stripping rules
│   ├── content.js       # iframe communication + extension detection
│   └── background.js    # Service worker
├── prisma/
│   └── schema.prisma    # Database schema
├── src/
│   ├── app/             # Next.js app router
│   ├── components/      # React components
│   ├── hooks/           # Custom hooks
│   ├── lib/             # Utilities
│   ├── providers/       # Context providers
│   └── types/           # TypeScript types
└── pages/               # Next.js pages router (Clerk)
```

## Database Schema

- **User** — clerk user ID, email, name
- **Room** — workspace with name, owner, members
- **RoomMember** — user-room relationship with role
- **Widget** — iframe/tab with position (x, y), size (w, h), URL, title

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run linter
npx prisma db push   # Push schema to database
npx prisma migrate   # Run migrations
```

## License

MIT
