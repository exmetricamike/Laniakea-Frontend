import { http, HttpResponse } from "msw";
import {
  accounts as accountFixtures,
  instruments,
  portfolio,
  strategies,
  systems,
  venues,
} from "@/mocks/fixtures/data";

const api = "http://localhost:8000";
const replay = new Map<string, { body: string; response: unknown }>();
const STORE_KEY = "laniakea.mocks.accounts";
// MSW handlers run in the page, so in-memory state would vanish on reload; keep it in
// sessionStorage (cleared by POST /__mocks/reset).
type MockAccount = (typeof accountFixtures)[number];
function loadAccounts(): MockAccount[] {
  if (typeof sessionStorage === "undefined") return structuredClone(accountFixtures);
  const saved = sessionStorage.getItem(STORE_KEY);
  return saved ? (JSON.parse(saved) as MockAccount[]) : structuredClone(accountFixtures);
}
function saveAccounts(): void {
  if (typeof sessionStorage !== "undefined")
    sessionStorage.setItem(STORE_KEY, JSON.stringify(accounts));
}
let accounts = loadAccounts();
let nextAccountId = Math.max(20, ...accounts.map((item) => item.id + 1));
const verificationPolls = new Map<number, number>();
const balancePolls = new Map<number, number>();
const list = <T>(results: T[]) => ({ results, next: null, count: results.length });
const command = {
  id: 77,
  system: 42,
  kind: "command",
  status: "pending",
  created_at: "2026-10-22T10:00:00Z",
};
function error(code: string, message: string, status: number) {
  return HttpResponse.json({ error: { code, message, fields: {}, reasons: [] } }, { status });
}
export function resetIdempotency(): void {
  replay.clear();
}
export function resetAccountMocks(): void {
  accounts = structuredClone(accountFixtures);
  nextAccountId = 20;
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(STORE_KEY);
  verificationPolls.clear();
  balancePolls.clear();
}
export async function idempotent(
  request: Request,
  response: Record<string, unknown>,
): Promise<Response | null> {
  const key = request.headers.get("Idempotency-Key");
  if (!key) return error("validation_error", "Idempotency-Key is required", 400);
  const body = await request.clone().text();
  const previous = replay.get(key);
  if (previous && previous.body !== body) return error("conflict", "Idempotency key conflict", 409);
  if (previous)
    return HttpResponse.json(previous.response as Record<string, unknown>, { status: 202 });
  replay.set(key, { body, response });
  return null;
}

export const handlers = [
  http.post(`${api}/__mocks/reset`, () => {
    resetAccountMocks();
    resetIdempotency();
    return new HttpResponse(null, {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }),
  http.post(`${api}/api/jwt/create/`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    return body.password === "demo"
      ? HttpResponse.json({ access: "mock-access", refresh: "mock-refresh" })
      : error("not_authenticated", "Invalid credentials", 401);
  }),
  http.post(`${api}/api/jwt/refresh/`, () => HttpResponse.json({ access: "mock-access" })),
  http.get(`${api}/api/users/me/`, () =>
    HttpResponse.json({ email: "demo@example.test", is_staff: true }),
  ),
  http.get(`${api}/api/engine/v1/venues/`, () => HttpResponse.json(list(venues))),
  http.get(`${api}/api/engine/v1/instruments/`, () => HttpResponse.json(list(instruments))),
  http.get(`${api}/api/engine/v1/instruments/:id/`, () => HttpResponse.json(instruments[0])),
  http.get(`${api}/api/engine/v1/instruments/:id/candles/`, () =>
    HttpResponse.json({
      t: [1],
      open: ["1"],
      high: ["1"],
      low: ["1"],
      close: ["1"],
      volume: ["1"],
    }),
  ),
  http.get(`${api}/api/engine/v1/strategies/`, () => HttpResponse.json(list(strategies))),
  http.get(`${api}/api/engine/v1/strategies/:family/:name/`, ({ params }) =>
    HttpResponse.json(
      strategies.find((item) => item.key === `${params.family}/${params.name}`) ?? strategies[0],
    ),
  ),
  http.get(`${api}/api/engine/v1/strategies/:family/:name/versions/`, () =>
    HttpResponse.json(list(strategies)),
  ),
  http.get(`${api}/api/engine/v1/strategies/:family/:name/versions/:version/`, () =>
    HttpResponse.json(strategies[0]),
  ),
  http.get(`${api}/api/engine/v1/accounts/`, () => HttpResponse.json(list(accounts))),
  http.get(`${api}/api/engine/v1/accounts/:id/`, ({ params }) => {
    const id = Number(params.id);
    const account = accounts.find((item) => item.id === id);
    if (!account) return error("not_found", "Account not found.", 404);
    const polls = verificationPolls.get(id) ?? 0;
    if (account.verification_pending && polls >= 1) {
      account.verification_pending = false;
      const invalid = account.label.toLowerCase().includes("withdraw");
      account.status = invalid ? "invalid" : "verified";
      account.permissions = invalid
        ? { trade: true, withdraw: true }
        : { trade: true, withdraw: false };
      account.probe_error = invalid ? "key can withdraw: create a trade-only key" : "";
    }
    verificationPolls.set(id, polls + 1);
    saveAccounts();
    return HttpResponse.json(account);
  }),
  http.get(`${api}/api/engine/v1/accounts/:id/balance/`, ({ params }) => {
    const id = Number(params.id);
    const polls = balancePolls.get(id) ?? 0;
    balancePolls.set(id, polls + 1);
    const probeError = accounts.find((item) => item.id === id)?.probe_error ?? "";
    if (probeError && polls > 0)
      return HttpResponse.json({ balances: [], as_of: null, pending: false, error: probeError });
    return HttpResponse.json(
      polls === 0
        ? { balances: [], as_of: null, pending: true, error: "" }
        : {
            balances: [{ currency: "USDT", total: "100.00", free: "75.00" }],
            as_of: "2026-10-22T10:00:00Z",
            pending: false,
            error: "",
          },
    );
  }),
  http.post(`${api}/api/engine/v1/accounts/:id/verify/`, ({ params }) => {
    const account = accounts.find((item) => item.id === Number(params.id));
    if (!account) return error("not_found", "Account not found.", 404);
    account.verification_pending = true;
    verificationPolls.set(account.id, 0);
    saveAccounts();
    return HttpResponse.json(account, { status: 202 });
  }),
  http.post(`${api}/api/engine/v1/accounts/`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const venue = venues.find((item) => item.id === body.venue);
    const credentials = body.credentials as Record<string, unknown> | undefined;
    if (
      !venue ||
      !credentials ||
      venue.credential_fields.some((field) => !credentials[field.name])
    ) {
      return HttpResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Invalid request.",
            fields: { credentials: ["Credentials do not match this venue."] },
            reasons: [],
          },
        },
        { status: 400 },
      );
    }
    const account = {
      id: nextAccountId++,
      venue: venue.id,
      label: String(body.label ?? "New account"),
      is_testnet: body.is_testnet === true,
      status: "unverified" as const,
      verified_at: null,
      permissions: {},
      credentials_set: true,
      credential_hint: "…1234",
      risk: {
        daily_loss_limit: null,
        max_drawdown_pct: null,
        breaker_policy: "cancel_orders" as const,
      },
      kill_switch: { active: false },
      systems_count: 0,
      created_at: "2026-10-22T18:51:03.220524Z",
      verification_pending: false,
      probe_error: "",
    };
    accounts.push(account);
    saveAccounts();
    return HttpResponse.json(account, { status: 201 });
  }),
  http.patch(`${api}/api/engine/v1/accounts/:id/`, async ({ params, request }) => {
    const account = accounts.find((item) => item.id === Number(params.id));
    if (!account) return error("not_found", "Account not found.", 404);
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.label === "string") account.label = body.label;
    if ("daily_loss_limit" in body)
      account.risk.daily_loss_limit = body.daily_loss_limit as string | null;
    if ("max_drawdown_pct" in body)
      account.risk.max_drawdown_pct = body.max_drawdown_pct as number | null;
    if (body.breaker_policy === "cancel_orders" || body.breaker_policy === "flatten")
      account.risk.breaker_policy = body.breaker_policy;
    if (body.credentials) {
      account.status = "unverified";
      account.verification_pending = false;
    }
    saveAccounts();
    return HttpResponse.json(account);
  }),
  http.delete(`${api}/api/engine/v1/accounts/:id/`, ({ params }) => {
    const id = Number(params.id);
    const account = accounts.find((item) => item.id === id);
    if (!account) return error("not_found", "Account not found.", 404);
    if (account.systems_count > 0)
      return error("conflict", `Account is used by ${account.systems_count} trading systems.`, 409);
    accounts = accounts.filter((item) => item.id !== id);
    saveAccounts();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${api}/api/engine/v1/portfolio/summary/`, ({ request }) => {
    // SPEC §7.4: live and paper are never summed together; the summary is per mode.
    const mode = new URL(request.url).searchParams.get("mode") ?? "live";
    return HttpResponse.json({
      ...portfolio,
      mode,
      systems: portfolio.systems.filter((system) => system.mode === mode),
    });
  }),
  http.get(`${api}/api/engine/v1/portfolio/equity/`, () =>
    HttpResponse.json({
      interval: "1h",
      buckets: [
        {
          currency: "USD*",
          t: [1730811600000],
          value: ["12387.40"],
          drawdown: [0],
          allocation: ["12000"],
        },
      ],
    }),
  ),
  http.get(`${api}/api/engine/v1/portfolio/trades/`, () =>
    HttpResponse.json(
      list([
        {
          id: 901,
          system: { id: 42, name: "BTC ATR 1h" },
          instrument: { id: 812, symbol: "BTC/USDT" },
          side: "long",
          status: "closed",
          opened_at: "2026-10-21T10:00:00Z",
          closed_at: "2026-10-22T10:00:00Z",
          max_size: "0.031",
          entry_avg: "64100",
          exit_avg: "65220",
          pnl_net: "32.71",
          origin: "strategy",
        },
      ]),
    ),
  ),
  http.get(`${api}/api/engine/v1/portfolio/orders/`, () =>
    HttpResponse.json(
      list([
        {
          id: 9001,
          side: "buy",
          type: "limit",
          size: "0.031",
          price: "64000",
          status: "partial",
          filled_size: "0.010",
        },
      ]),
    ),
  ),
  http.get(`${api}/api/engine/v1/portfolio/fills/`, () =>
    HttpResponse.json(
      list([
        {
          id: 1001,
          system: 42,
          order: 9001,
          size: "0.010",
          price: "63999.5",
          time: "2026-10-22T10:00:00Z",
        },
      ]),
    ),
  ),
  http.get(`${api}/api/engine/v1/portfolio/positions/`, () =>
    HttpResponse.json(
      list([{ system: 42, size: "0.031", side: "long", avg_price: "64100", mark_price: "64945" }]),
    ),
  ),
  http.get(`${api}/api/engine/v1/systems/`, ({ request }) => {
    const url = new URL(request.url);
    const filtered = systems.filter(
      (system) =>
        (!url.searchParams.get("state") || system.state === url.searchParams.get("state")) &&
        (!url.searchParams.get("mode") || system.mode === url.searchParams.get("mode")),
    );
    return HttpResponse.json(list(filtered));
  }),
  http.get(`${api}/api/engine/v1/systems/:id/`, ({ params }) =>
    HttpResponse.json({
      ...(systems.find((item) => item.id === Number(params.id)) ?? systems[0]),
      strategy: strategies[0].key,
      version: "1.0.0",
      params: {},
      risk: {},
      cost_model: { fee_rate: 0.001 },
      account: 7,
      timeframe: "1h",
      desired_state: "running",
      started_at: "2026-10-22T09:00:00Z",
      stopped_at: null,
    }),
  ),
  http.get(`${api}/api/engine/v1/systems/:id/performance/`, () =>
    HttpResponse.json({
      period_pnl: { today: "12.30" },
      metrics: { return: 0.04 },
      backtest_evidence: 1,
    }),
  ),
  http.get(`${api}/api/engine/v1/systems/:id/equity/`, () =>
    HttpResponse.json({
      t: [1730811600000],
      value: ["2087.40"],
      drawdown: [0],
      realised: ["0"],
      unrealised: ["12.30"],
    }),
  ),
  http.get(`${api}/api/engine/v1/systems/:id/trades/`, () =>
    HttpResponse.json(
      list([{ id: 901, status: "open", side: "long", max_size: "0.031", origin: "strategy" }]),
    ),
  ),
  http.get(`${api}/api/engine/v1/systems/:id/orders/`, () =>
    HttpResponse.json(
      list([
        {
          id: 9001,
          client_id: "e42s000137",
          side: "buy",
          type: "limit",
          size: "0.031",
          price: "64000",
          status: "partial",
          filled_size: "0.010",
          reduce_only: false,
          allowed_actions: ["cancel_order", "modify_order"],
        },
      ]),
    ),
  ),
  http.get(`${api}/api/engine/v1/systems/:id/fills/`, () =>
    HttpResponse.json(list([{ id: 1001, order: 9001, size: "0.010", price: "63999.5" }])),
  ),
  http.get(`${api}/api/engine/v1/systems/:id/position/`, () =>
    HttpResponse.json({
      size: "0.031",
      side: "long",
      avg_price: "64100",
      mark_price: "64945",
      marked_at: "2026-10-22T10:00:00Z",
      unrealised_pnl: "12.30",
      venue_size: "0.031",
      reconciled_at: "2026-10-22T10:00:00Z",
    }),
  ),
  http.get(`${api}/api/engine/v1/systems/:id/events/`, () =>
    HttpResponse.json(
      list([
        {
          id: 1,
          severity: "warning",
          kind: "reconcile.mismatch",
          message: "Demo event",
          time: "2026-10-22T10:00:00Z",
        },
      ]),
    ),
  ),
  http.get(`${api}/api/engine/v1/systems/:id/chart/`, () =>
    HttpResponse.json({
      t: [1730811600000],
      open: ["64010"],
      high: ["64100"],
      low: ["63900"],
      close: ["64050"],
      volume: ["1.2"],
      indicators: { atr: { pane: "sub", values: [312.4] } },
      markers: [
        {
          t: 1730811600000,
          kind: "fill",
          side: "buy",
          price: "64000",
          size: "0.031",
          origin: "strategy",
          order_id: 9001,
        },
      ],
      open_orders: [
        {
          order_id: 9002,
          side: "sell",
          type: "limit",
          price: "66000",
          stop_price: null,
          tag: "TP",
        },
      ],
    }),
  ),
  http.get(`${api}/api/engine/v1/systems/:id/commands/`, () =>
    HttpResponse.json(list([{ ...command, status: "done", reason: null, result: {} }])),
  ),
  http.get(`${api}/api/engine/v1/systems/:id/shadow-reports/`, () => HttpResponse.json(list([]))),
  http.get(`${api}/api/engine/v1/backtests/`, () =>
    HttpResponse.json(
      list([
        { id: 1, strategy: strategies[0].key, status: "done", caveats: ["Demo"] },
        { id: 2, strategy: strategies[1].key, status: "running" },
      ]),
    ),
  ),
  http.get(`${api}/api/engine/v1/backtests/:id/`, ({ params }) =>
    HttpResponse.json(
      Number(params.id) === 2
        ? { id: 2, strategy: strategies[1].key, status: "running", progress: 0.5 }
        : {
            id: 1,
            strategy: strategies[0].key,
            status: "done",
            in_sample_end: "2022-12-31T00:00:00Z",
            cost_model: { fee_rate: 0.001 },
            caveats: ["Demo caveat"],
            result: { metrics: { full: {}, in_sample: {}, out_of_sample: {} } },
          },
    ),
  ),
  http.get(`${api}/api/engine/v1/backtests/:id/equity/`, () =>
    HttpResponse.json({ t: [1730811600000], value: ["10000"], drawdown: [0] }),
  ),
  http.get(`${api}/api/engine/v1/backtests/:id/trades/`, () =>
    HttpResponse.json(list([{ id: 901, status: "closed" }])),
  ),
  http.get(`${api}/api/engine/v1/backtests/:id/orders/`, () =>
    HttpResponse.json(list([{ id: 9001, status: "filled" }])),
  ),
  http.get(`${api}/api/engine/v1/backtests/:id/chart/`, () =>
    HttpResponse.json({
      t: [1730811600000],
      open: ["1"],
      high: ["1"],
      low: ["1"],
      close: ["1"],
      volume: ["1"],
      indicators: {},
      markers: [],
      open_orders: [],
    }),
  ),
  http.get(`${api}/api/engine/v1/kill-switches/`, () =>
    HttpResponse.json(
      list([
        { scope: "tenant", target: null, active: false },
        { scope: "account", target: 7, active: true },
      ]),
    ),
  ),
  http.get(`${api}/api/engine/v1/operator/systems/`, () => HttpResponse.json(list(systems))),
  http.get(`${api}/api/engine/v1/audit-log/`, () =>
    HttpResponse.json(list([{ id: 1, action: "system.start", time: "2026-10-22T10:00:00Z" }])),
  ),
  http.get(`${api}/api/engine/v1/health/`, () =>
    HttpResponse.json({ supervisor: "alive", workers: [], redis: "ok", database: "ok" }),
  ),
  http.post(`${api}/api/engine/v1/systems/`, () =>
    HttpResponse.json({ ...systems[2], id: 99 }, { status: 201 }),
  ),
  http.patch(`${api}/api/engine/v1/systems/:id/`, () => HttpResponse.json(systems[2])),
  http.delete(`${api}/api/engine/v1/systems/:id/`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${api}/api/engine/v1/systems/:id/:action/`, async ({ request }) => {
    const cached = await idempotent(request, command);
    return cached ?? HttpResponse.json(command, { status: 202 });
  }),
  http.delete(`${api}/api/engine/v1/systems/:id/orders/:orderId/`, async ({ request }) => {
    const cached = await idempotent(request, command);
    return cached ?? HttpResponse.json(command, { status: 202 });
  }),
  http.patch(`${api}/api/engine/v1/systems/:id/orders/:orderId/`, async ({ request }) => {
    const cached = await idempotent(request, command);
    return cached ?? HttpResponse.json(command, { status: 202 });
  }),
  http.post(`${api}/api/engine/v1/systems/:id/orders/`, async ({ request }) => {
    const cached = await idempotent(request, command);
    return cached ?? HttpResponse.json(command, { status: 202 });
  }),
  http.post(`${api}/api/engine/v1/kill-switches/`, async ({ request }) => {
    const cached = await idempotent(request, command);
    return (
      cached ??
      HttpResponse.json({ scope: "tenant", active: true, reason: "Demo" }, { status: 202 })
    );
  }),
  http.post(`${api}/api/engine/v1/kill-switches/global/`, async ({ request }) => {
    const cached = await idempotent(request, command);
    return (
      cached ??
      HttpResponse.json({ scope: "global", active: true, reason: "Demo" }, { status: 202 })
    );
  }),
  http.post(`${api}/api/engine/v1/backtests/`, async ({ request }) => {
    const response = { id: 3, status: "queued", strategy: strategies[0].key };
    const cached = await idempotent(request, response);
    return cached ?? HttpResponse.json(response, { status: 201 });
  }),
  http.post(`${api}/api/engine/v1/backtests/:id/cancel/`, () =>
    HttpResponse.json({ id: 1, status: "cancelled" }, { status: 202 }),
  ),
  http.post(`${api}/api/engine/v1/operator/strategies/:family/:name/versions/`, () =>
    HttpResponse.json(strategies[0], { status: 201 }),
  ),
  http.post(
    `${api}/api/engine/v1/operator/strategies/:family/:name/versions/:version/unpublish/`,
    () => HttpResponse.json({ ...strategies[0], published_at: null }, { status: 202 }),
  ),
  http.all(`${api}/api/engine/v1/*`, () => error("not_found", "Mock endpoint not found", 404)),
];
