import { http, HttpResponse } from "msw";
import {
  accounts as accountFixtures,
  instruments,
  portfolio,
  strategies,
  strategyVersionDetails,
  strategyVersions,
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
let systemRows = structuredClone(systems);
type MockKillSwitch = {
  scope: "tenant" | "account" | "global";
  target: number | null;
  active: boolean;
  reason: string;
  set_by: string | null;
  set_at: string | null;
};
let killSwitchRows: MockKillSwitch[] = [
  { scope: "tenant" as const, target: null, active: false, reason: "", set_by: null, set_at: null },
  {
    scope: "account" as const,
    target: 7,
    active: true,
    reason: "Demo",
    set_by: "demo@example.test",
    set_at: "2026-10-22T10:00:00Z",
  },
];
let nextSystemId = Math.max(...systemRows.map((item) => item.id)) + 1;
let nextAccountId = Math.max(20, ...accounts.map((item) => item.id + 1));
const verificationPolls = new Map<number, number>();
const balancePolls = new Map<number, number>();
let failNextVersionDetail = false;
let failNextStart = false;
let blockNextStart = false;
const list = <T>(results: T[]) => ({ results, next: null, count: results.length });
function portfolioFixture(): "default" | "large" | "empty" | "paper-only" {
  if (typeof localStorage === "undefined") return "default";
  const value = localStorage.getItem("laniakea.mocks.portfolio");
  return value === "large" || value === "empty" || value === "paper-only" ? value : "default";
}
function largeSystems() {
  return Array.from({ length: 50 }, (_, index) => ({
    ...systems[index % systems.length],
    id: 1_000 + index,
    name: `Large system ${index + 1}`,
    mode: "paper" as const,
    state: index === 0 ? ("halted" as const) : ("running" as const),
  }));
}
function fixtureSystems() {
  const fixture = portfolioFixture();
  if (fixture === "empty") return [];
  if (fixture === "large") return largeSystems();
  if (fixture === "paper-only") return systemRows.filter((system) => system.mode === "paper");
  return systemRows;
}
const portfolioTrades = [
  {
    id: 902,
    system: { id: 43, name: "Paper trend" },
    instrument: { id: 812, symbol: "BTC/USDT" },
    side: "long",
    status: "open",
    opened_at: "2026-10-22T10:00:00Z",
    closed_at: null,
    max_size: "0.031",
    entry_avg: "64100",
    exit_avg: null,
    pnl_gross: "34.20",
    fees: "1.49",
    pnl_net: "32.71",
    return: 0.0164,
    bars: 14,
    origin: "strategy",
    has_manual_fills: false,
    tags: ["breakout"],
  },
  {
    id: 901,
    system: { id: 43, name: "Paper trend" },
    instrument: { id: 812, symbol: "BTC/USDT" },
    side: "long",
    status: "closed",
    opened_at: "2026-10-21T10:00:00Z",
    closed_at: "2026-10-22T10:00:00Z",
    max_size: "0.031",
    entry_avg: "64100",
    exit_avg: "65220",
    pnl_gross: "34.20",
    fees: "1.49",
    pnl_net: "32.71",
    return: 0.0164,
    bars: 14,
    origin: "strategy",
    has_manual_fills: false,
    tags: [],
  },
];
function fixtureTrades() {
  if (portfolioFixture() !== "large") return portfolioTrades;
  return Array.from({ length: 5_000 }, (_, index) => ({
    ...portfolioTrades[index % portfolioTrades.length],
    id: 10_000 - index,
    system: { id: 1_000 + (index % 50), name: `Large system ${(index % 50) + 1}` },
  }));
}
const command = {
  id: 77,
  system: 42,
  kind: "command",
  payload: {},
  status: "pending",
  reason: null,
  result: {},
  created_by: null,
  created_at: "2026-10-22T10:00:00Z",
  finished_at: null,
};
const backtestJob = {
  id: 1,
  strategy: "atr_strategies/atr_allocation",
  version: "1.0.0",
  params: {},
  instrument: { id: 812, venue: "binance", symbol: "BTC/USDT" },
  timeframe: "1h",
  start: "2021-01-01T00:00:00Z",
  end: "2021-03-01T00:00:00Z",
  in_sample_end: "2021-02-01T00:00:00Z",
  trade_start: null,
  allocation: "10000",
  cost_model: { instrument_kind: "spot", fee_rate: 0.001, slippage_bps: 0, leverage: 1 },
  status: "done",
  progress: 1,
  error: "",
  created_at: "2026-10-22T10:00:00Z",
  started_at: "2026-10-22T10:00:01Z",
  finished_at: "2026-10-22T10:00:02Z",
  metrics: {
    full: { total_return: 0.1, max_drawdown: 0.02, trades: 1 },
    in_sample: { total_return: 0.05, max_drawdown: 0.01, trades: 1 },
    out_of_sample: { total_return: 0.05, max_drawdown: 0.01, trades: 0 },
  },
  caveats: ["Demo caveat"],
  dataset_sha256: "abc123",
  engine_revision: "mock",
  trades_count: 1,
};
let queuedBacktestPolls = 0;
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
  failNextVersionDetail = false;
  failNextStart = false;
  blockNextStart = false;
  queuedBacktestPolls = 0;
  systemRows = structuredClone(systems);
  killSwitchRows = [
    { scope: "tenant", target: null, active: false, reason: "", set_by: null, set_at: null },
    {
      scope: "account",
      target: 7,
      active: true,
      reason: "Demo",
      set_by: "demo@example.test",
      set_at: "2026-10-22T10:00:00Z",
    },
  ];
  nextSystemId = Math.max(...systemRows.map((item) => item.id)) + 1;
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
  http.post(`${api}/__mocks/fail-next/strategy-version-detail`, () => {
    failNextVersionDetail = true;
    return new HttpResponse(null, {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }),
  http.post(`${api}/__mocks/fail-next/system-start`, () => {
    failNextStart = true;
    return new HttpResponse(null, {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }),
  http.post(`${api}/__mocks/fail-next/system-start-blockers`, () => {
    blockNextStart = true;
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
  http.get(`${api}/api/engine/v1/strategies/:family/:name/`, ({ params }) => {
    const strategy = strategies.find((item) => item.key === `${params.family}/${params.name}`);
    return strategy ? HttpResponse.json(strategy) : error("not_found", "Not found.", 404);
  }),
  http.get(`${api}/api/engine/v1/strategies/:family/:name/versions/`, ({ params }) => {
    const key = `${params.family}/${params.name}`;
    return key in strategyVersions
      ? HttpResponse.json(list(strategyVersions[key]))
      : error("not_found", "Not found.", 404);
  }),
  http.get(`${api}/api/engine/v1/strategies/:family/:name/versions/:version/`, ({ params }) => {
    if (failNextVersionDetail) {
      failNextVersionDetail = false;
      return error("server_error", "Temporary failure.", 500);
    }
    const detail = strategyVersionDetails[`${params.family}/${params.name}:${params.version}`];
    return detail ? HttpResponse.json(detail) : error("not_found", "Not found.", 404);
  }),
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
    const fixture = portfolioFixture();
    const rows = fixtureSystems().filter((system) => system.mode === mode);
    return HttpResponse.json({
      ...portfolio,
      mode,
      systems: rows,
      buckets: fixture === "empty" || rows.length === 0 ? [] : portfolio.buckets,
      alerts: portfolio.alerts.filter((alert) => rows.some((system) => system.id === alert.system)),
    });
  }),
  http.get(`${api}/api/engine/v1/portfolio/equity/`, () =>
    HttpResponse.json({
      interval: "1h",
      buckets:
        portfolioFixture() === "empty"
          ? []
          : [
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
  http.get(`${api}/api/engine/v1/portfolio/trades/`, ({ request }) => {
    const rows = portfolioFixture() === "empty" ? [] : fixtureTrades();
    const cursor = Number(new URL(request.url).searchParams.get("cursor") ?? "0");
    const start = Number.isFinite(cursor) ? cursor : 0;
    const results = rows.slice(start, start + 50);
    const next =
      start + 50 < rows.length
        ? `${api}/api/engine/v1/portfolio/trades/?cursor=${start + 50}`
        : null;
    return HttpResponse.json({ results, next, count: null });
  }),
  http.get(`${api}/api/engine/v1/portfolio/orders/`, () =>
    HttpResponse.json(
      portfolioFixture() === "empty"
        ? list([])
        : list([
            {
              id: 9001,
              side: "buy",
              type: "limit",
              size: "0.031",
              price: "64000",
              status: "partial",
              filled_size: "0.010",
              system: { id: 43, name: "Paper trend" },
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
      portfolioFixture() === "empty"
        ? list([])
        : list([
            {
              system: { id: 43, name: "Paper trend", mode: "paper" },
              instrument: { id: 812, venue: "binance", symbol: "BTC/USDT" },
              settle: "USDT",
              size: "0.031",
              side: "long",
              avg_price: "64100",
              mark_price: "64945",
              marked_at: "2026-10-22T10:00:00Z",
              unrealised_pnl: "0",
              venue_size: null,
              reconciled_at: null,
            },
          ]),
    ),
  ),
  http.get(`${api}/api/engine/v1/systems/`, ({ request }) => {
    const url = new URL(request.url);
    const filtered = fixtureSystems().filter(
      (system) =>
        (!url.searchParams.get("state") || system.state === url.searchParams.get("state")) &&
        (!url.searchParams.get("mode") || system.mode === url.searchParams.get("mode")) &&
        (!url.searchParams.get("strategy") ||
          system.strategy === url.searchParams.get("strategy")) &&
        (!url.searchParams.get("account") ||
          String(system.account) === url.searchParams.get("account")),
    );
    return HttpResponse.json(list(filtered));
  }),
  http.get(`${api}/api/engine/v1/systems/:id/`, ({ params }) => {
    const system = systemRows.find((item) => item.id === Number(params.id));
    if (!system) return error("not_found", "Not found.", 404);
    return HttpResponse.json({
      ...system,
      strategy: strategies[0].key,
      version: "1.0.0",
      params: {},
      risk: {},
      account: 7,
      timeframe: "1h",
      desired_state: "running",
      started_at: "2026-10-22T09:00:00Z",
      stopped_at: null,
    });
  }),
  http.get(`${api}/api/engine/v1/systems/:id/performance/`, () =>
    HttpResponse.json({
      from: null,
      to: null,
      period_pnl: { today: "12.30", "7d": "24.60", "30d": "55.10", all: "87.20" },
      metrics: { total_return: 0.04, sharpe: 1.4, trades: 14, win_rate: 0.57, profit_factor: 1.8 },
      backtest_evidence: [{ backtest_id: 1, label: "Published ATR backtest" }],
    }),
  ),
  http.get(`${api}/api/engine/v1/systems/:id/equity/`, () =>
    HttpResponse.json({
      interval: "1h",
      t: [1730811600000],
      value: ["2087.40"],
      drawdown: [0],
      realised: ["0"],
      unrealised: ["12.30"],
    }),
  ),
  http.get(`${api}/api/engine/v1/systems/:id/trades/`, () =>
    HttpResponse.json(
      list([
        {
          id: 901,
          status: "closed",
          side: "long",
          max_size: "0.031",
          origin: "strategy",
          opened_at: "2026-10-21T10:00:00Z",
          closed_at: "2026-10-22T10:00:00Z",
          entry_avg: "64100",
          exit_avg: "65220",
          pnl_gross: "33.71",
          fees: "1",
          pnl_net: "32.71",
          return: 0.02,
          bars: 24,
        },
      ]),
    ),
  ),
  http.get(`${api}/api/engine/v1/systems/:id/orders/`, () =>
    HttpResponse.json(
      list([
        {
          id: 9001,
          client_id: "e42s000137",
          tag: "TP",
          origin: "strategy",
          created_by: null,
          side: "buy",
          type: "limit",
          size: "0.031",
          price: "64000",
          stop_price: null,
          status: "partial",
          filled_size: "0.010",
          avg_fill_price: "64000",
          reject_reason: null,
          cancelled_by: null,
          replaces: null,
          replaced_by: null,
          bar_time: "2026-10-22T10:00:00Z",
          created_at: "2026-10-22T10:00:00Z",
          updated_at: "2026-10-22T10:00:00Z",
          reduce_only: false,
          allowed_actions: ["cancel_order", "modify_order"],
        },
      ]),
    ),
  ),
  http.get(`${api}/api/engine/v1/systems/:id/fills/`, () =>
    HttpResponse.json(
      list([
        {
          id: 1001,
          order_id: 9001,
          size: "0.010",
          price: "63999.5",
          time: "2026-10-22T10:00:00Z",
          side: "buy",
          fee: "0.10",
          fee_currency: "USDT",
          liquidity: "maker",
          origin: "strategy",
        },
      ]),
    ),
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
          seq: 1,
          severity: "warning",
          kind: "reconcile.mismatch",
          message: "Demo event",
          data: {},
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
      indicators: {},
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
  http.get(`${api}/api/engine/v1/backtests/`, () => HttpResponse.json(list([backtestJob]))),
  http.get(`${api}/api/engine/v1/backtests/:id/`, ({ params }) => {
    if (Number(params.id) !== 2) return HttpResponse.json(backtestJob);
    queuedBacktestPolls += 1;
    return HttpResponse.json(
      queuedBacktestPolls < 2
        ? { ...backtestJob, id: 2, status: "queued", progress: 0, metrics: null }
        : { ...backtestJob, id: 2 },
    );
  }),
  http.get(`${api}/api/engine/v1/backtests/:id/equity/`, () =>
    HttpResponse.json({ t: [1730811600000], value: ["10000"], drawdown: [0] }),
  ),
  http.get(`${api}/api/engine/v1/backtests/:id/trades/`, () =>
    HttpResponse.json(
      list([
        {
          side: "long",
          entry_time: "2021-01-01T00:00:00",
          exit_time: "2021-01-02T00:00:00",
          pnl_net: "1",
          pnl: "1",
          commission: "0",
          bars: 1,
          size: "1",
          segment: "in_sample",
          entry_price: "1",
        },
      ]),
    ),
  ),
  http.get(`${api}/api/engine/v1/backtests/:id/orders/`, () =>
    HttpResponse.json(
      list([
        {
          tag: null,
          side: "buy",
          size: "1",
          type: "Market",
          price: "1",
          status: "Completed",
          created: "2021-01-01T00:00:00",
          filled_at: "2021-01-01T00:00:00",
          fill_price: "1",
        },
      ]),
    ),
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
  http.get(`${api}/api/engine/v1/kill-switches/`, () => HttpResponse.json(list(killSwitchRows))),
  http.get(`${api}/api/engine/v1/operator/systems/`, () => HttpResponse.json(list(systems))),
  http.get(`${api}/api/engine/v1/audit-log/`, () =>
    HttpResponse.json(list([{ id: 1, action: "system.start", time: "2026-10-22T10:00:00Z" }])),
  ),
  http.get(`${api}/api/engine/v1/health/`, () =>
    HttpResponse.json({ supervisor: "alive", workers: [], redis: "ok", database: "ok" }),
  ),
  http.post(`${api}/api/engine/v1/systems/`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const params = body.params as Record<string, unknown> | undefined;
    if (params?.trailing_atr_period === "invalid" || params?.trailing_atr_period === 0) {
      return HttpResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Invalid request.",
            fields: { params: ["trailing_atr_period: 'invalid' is not of type 'integer'"] },
            reasons: [],
          },
        },
        { status: 400 },
      );
    }
    const instrument =
      instruments.find((item) => item.id === Number(body.instrument)) ?? instruments[0];
    const row = {
      ...systemRows[0],
      id: nextSystemId++,
      name: String(body.name ?? "New system"),
      mode: body.mode === "live" ? ("live" as const) : ("paper" as const),
      state: "stopped" as const,
      instrument: { id: instrument.id, venue: instrument.venue, symbol: instrument.symbol },
      strategy: String(body.strategy ?? strategies[0].key),
      version: String(body.version ?? "1.0.0"),
      params: (params ?? {}) as (typeof systemRows)[number]["params"],
      account: typeof body.account === "number" ? body.account : null,
      timeframe: String(body.timeframe ?? "1h"),
      allocation: String(body.allocation ?? "10000"),
      risk: (body.risk ?? {}) as (typeof systemRows)[number]["risk"],
      cost_model: (body.cost_model ??
        systemRows[0].cost_model) as (typeof systemRows)[number]["cost_model"],
      desired_state: "stopped" as const,
      allowed_actions: ["edit", "start", "delete"],
    };
    systemRows.unshift(row);
    return HttpResponse.json(row, { status: 201 });
  }),
  http.patch(`${api}/api/engine/v1/systems/:id/`, () => HttpResponse.json(systemRows[2])),
  http.delete(`${api}/api/engine/v1/systems/:id/`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${api}/api/engine/v1/systems/:id/start/`, async ({ params, request }) => {
    const system = systemRows.find((item) => item.id === Number(params.id));
    if (!system) return error("not_found", "System not found.", 404);
    if (failNextStart) {
      failNextStart = false;
      return error("server_error", "Temporary failure.", 500);
    }
    if (blockNextStart) {
      blockNextStart = false;
      return HttpResponse.json(
        {
          error: {
            code: "precondition_failed",
            message: "Cannot start.",
            fields: {},
            reasons: ["account_unverified", "kill_switch_active"],
          },
        },
        { status: 412 },
      );
    }
    const cached = await idempotent(request, system);
    if (cached) return cached;
    system.desired_state = "running";
    system.state = "running";
    system.allowed_actions = ["stop", "new_order"];
    return HttpResponse.json(system, { status: 202 });
  }),
  http.post(`${api}/api/engine/v1/systems/:id/stop/`, async ({ params, request }) => {
    const system = systemRows.find((item) => item.id === Number(params.id));
    if (!system) return error("not_found", "System not found.", 404);
    if (system.state !== "running") return error("conflict", "Invalid state.", 409);
    const body = (await request.clone().json()) as { policy?: string };
    if (!body.policy) return error("validation_error", "Policy is required.", 400);
    system.state = "stopped";
    system.desired_state = "stopped";
    system.stop_policy = body.policy as typeof system.stop_policy;
    system.allowed_actions = ["start", "edit", "delete"];
    return HttpResponse.json(system, { status: 202 });
  }),
  http.post(`${api}/api/engine/v1/systems/:id/ack/`, async ({ params, request }) => {
    const system = systemRows.find((item) => item.id === Number(params.id));
    if (!system) return error("not_found", "System not found.", 404);
    const body = (await request.json()) as { note?: string };
    if (!body.note?.trim()) return error("validation_error", "Note is required.", 400);
    if (system.state !== "halted") return error("conflict", "Invalid state.", 409);
    system.state = "stopped";
    system.desired_state = "stopped";
    system.allowed_actions = ["start", "edit", "delete"];
    return HttpResponse.json(system);
  }),
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
    const body = (await request.clone().json()) as {
      scope: "tenant" | "account";
      target?: number;
      active: boolean;
      reason: string;
    };
    const target = body.scope === "account" ? (body.target ?? null) : null;
    let row = killSwitchRows.find((item) => item.scope === body.scope && item.target === target);
    if (!row) {
      row = { scope: body.scope, target, active: false, reason: "", set_by: null, set_at: null };
      killSwitchRows.push(row);
    }
    const cached = await idempotent(request, row);
    if (cached) return cached;
    row.active = body.active;
    row.reason = body.reason;
    row.set_by = "demo@example.test";
    row.set_at = "2026-10-22T10:00:00Z";
    return HttpResponse.json(row);
  }),
  http.post(`${api}/api/engine/v1/kill-switches/global/`, async ({ request }) => {
    const body = (await request.json()) as { active: boolean; reason: string };
    let row = killSwitchRows.find((item) => item.scope === "global");
    if (!row) {
      row = {
        scope: "global",
        target: null,
        active: false,
        reason: "",
        set_by: null,
        set_at: null,
      };
      killSwitchRows.push(row);
    }
    row.active = body.active;
    row.reason = body.reason;
    row.set_by = "demo@example.test";
    row.set_at = "2026-10-22T10:00:00Z";
    return HttpResponse.json(row);
  }),
  http.post(`${api}/api/engine/v1/backtests/`, async ({ request }) => {
    const body = (await request.clone().json()) as {
      instrument?: number;
      cost_model?: { instrument_kind?: string };
    };
    if (body.cost_model?.instrument_kind === "linear_perp") {
      return HttpResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Invalid request.",
            fields: { instrument: ["No curated market data for this instrument and timeframe."] },
            reasons: [],
          },
        },
        { status: 400 },
      );
    }
    const response = { ...backtestJob, id: 3, status: "queued" as const, progress: 0 };
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
