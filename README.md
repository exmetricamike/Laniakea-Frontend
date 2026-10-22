# Laniakea frontend

Frontend scaffold for the Laniakea trading engine. It requires Node.js 20+ and the Django backend at `http://localhost:8000` for real sign-in.

1. Copy `.env.local.example` to `.env.local` to configure the API, WebSocket, and mock mode.
2. Dependencies are provisioned; do not install packages in this workspace.
3. Start the app with `npm run dev` and open `http://localhost:3001/login`.

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
