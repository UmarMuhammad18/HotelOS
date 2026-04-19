# HotelOS

Monorepo for the **HotelOS** hospitality stack: a Create React App dashboard (Vercel), a **Node.js + Express + WebSocket API** (`hotelos-api`), and an **Expo SDK 51** mobile client (`hotelos-mobile`).

## Repository layout

| Path | Description |
|------|-------------|
| `src/` | React web dashboard (CRA) |
| `hotelos-api/` | Production API: REST + WebSockets, SQLite via **sql.js** (WASM, no native DB binaries), Stripe, JWT login |
| `hotelos-mobile/` | Expo + TypeScript mobile app |
| `Database/` | Seed JSON for rooms and guests (used by the API on first boot) |
| `docker-compose.yml` | Runs `hotelos-api` with a persistent SQLite file volume |

## Quick start — API

```bash
cd hotelos-api
cp .env.example .env   # optional: edit PORT / secrets
npm install
npm start
```

- REST: `http://localhost:8080/api/...`
- Agent feed WebSocket: `ws://localhost:8080/` (same path convention as the legacy dev server)
- Chat WebSocket: `ws://localhost:8080/chat`

On first start the API creates `hotelos-api/dev.db` and seeds from `../Database/rooms.json` and `guests.json`. Staff demo user: `demo@hotelos.app` / `staff123`.

## Quick start — web dashboard

```bash
npm install
cp .env.example .env.local
# Set REACT_APP_API_URL to your deployed API (https://...) for production
npm start
```

Vercel: add the same variables in **Project → Settings → Environment Variables**. Rebuild after changing them.

## Quick start — mobile

```bash
cd hotelos-mobile
npm install
npx expo start
```

Use **Settings → API base URL** so a physical device can reach your machine (`http://192.168.x.x:8080`) or your cloud API (`https://...`). Changing the URL bumps the socket connections automatically.

See [MOBILE_BUILD.md](./MOBILE_BUILD.md) for EAS Build and store submission.

## API reference

See [BACKEND_API.md](./BACKEND_API.md) for every route and WebSocket payload.

## Deployment (API)

### Docker (from repo root)

```bash
docker compose up --build
```

Build context is the repository root so `Database/` is available for seeding. Set `JWT_SECRET`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` in your environment or in `docker-compose.yml`.

### Render / Railway / Fly.io

1. Point the service to **`hotelos-api`** (install command `npm install`, start `npm start`).
2. Set `PORT` to the platform’s assigned port (often automatic).
3. Mount a **persistent disk** for `DATABASE_FILE` (e.g. `/data/hotelos.db`) so SQLite survives restarts.
4. Configure Stripe keys and webhook URL (`https://<host>/api/stripe-webhook`).

## Tech notes

- **Persistence**: SQLite through **sql.js** keeps deployments simple and avoids Prisma/native engine issues on some Windows ARM dev machines. The same SQL schema can be migrated to PostgreSQL later if you prefer.
- **Charts on mobile**: The web app uses Recharts; Recharts targets DOM. The mobile app uses **lightweight SVG-style metrics** and Lottie where charts would go; for native charting you can add Victory Native or Skia in a follow-up.

## License

Private / your terms.
