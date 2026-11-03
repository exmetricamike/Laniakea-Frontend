# Laniakea frontend

Frontend scaffold for the Laniakea trading engine. It requires Node.js 20+ and the Django backend at `http://localhost:8000` for real sign-in.

## Run against the local backend

Prerequisites: Node.js 20+, dependencies already provisioned in this checkout, and the backend
started separately with `scripts/dev-up.sh start`. Seed the isolated browser-test tenant once with
`scripts/dev-up.sh seed-e2e` in the backend repository.

Copy `.env.local.example` to `.env.local` and set the local API and WebSocket keys:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_USE_MOCKS=false
```

Build and serve the frontend:

```sh
npm run build && npm run start
```

For a fresh clone only, install the lockfile dependencies with `npm ci`; that step requires registry
access. The real-backend Playwright smoke test uses `E2E_EMAIL` and `E2E_PASSWORD`, defaulting to
`e2e@local.test` and `Laniakea-e2e-1`.

For mock-focused development, set `NEXT_PUBLIC_USE_MOCKS=true` and use `npm run dev`.

Checks:

```sh
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
```

Playwright mocks the `users/me` endpoint and does not require the backend. The manual sign-in flow does.

## API types and mocks

Run `npm run api:types` while the local backend is available to refresh the committed OpenAPI types.
Set `NEXT_PUBLIC_USE_MOCKS=true` to enable MSW. Mock login accepts any email with password `demo`.
`npm run test:e2e` runs normal shell tests and the isolated mock server suite on port 3002.
