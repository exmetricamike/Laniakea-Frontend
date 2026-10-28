import { afterEach, describe, expect, it, vi } from "vitest";
import { EngineSocket, type SocketLike, useLiveStatus } from "@/lib/ws/socket";

class FakeSocket implements SocketLike {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sent: string[] = [];
  closed: number[] = [];

  send(data: string): void {
    this.sent.push(data);
  }

  close(code = 1000): void {
    this.closed.push(code);
    this.onclose?.({ code } as CloseEvent);
  }

  open(): void {
    this.onopen?.({} as Event);
  }

  receive(frame: unknown): void {
    this.onmessage?.({ data: JSON.stringify(frame) } as MessageEvent<unknown>);
  }
}

function message(socket: FakeSocket, index: number): Record<string, string> {
  return JSON.parse(socket.sent[index] ?? "{}") as Record<string, string>;
}

function setup(options: ConstructorParameters<typeof EngineSocket>[0] = {}) {
  const sockets: FakeSocket[] = [];
  const socket = new EngineSocket({
    createSocket: () => {
      const fake = new FakeSocket();
      sockets.push(fake);
      return fake;
    },
    accessToken: () => "access",
    random: () => 0.5,
    ...options,
  });
  return { socket, sockets };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
  useLiveStatus.getState().setStatus("connecting");
});

describe("EngineSocket", () => {
  it("authenticates before subscribing and serializes acknowledgements", () => {
    const { socket, sockets } = setup();
    socket.start();
    socket.subscribe("portfolio");
    socket.subscribe("system.42");
    const connection = sockets[0];
    expect(connection.sent).toHaveLength(0);
    connection.open();
    expect(message(connection, 0)).toEqual({ action: "auth", token: "access" });
    expect(connection.sent).toHaveLength(1);
    connection.receive({ type: "auth.ok" });
    expect(message(connection, 1)).toEqual({ action: "subscribe", channel: "portfolio" });
    connection.receive({ type: "subscribed", channel: "portfolio" });
    expect(message(connection, 2)).toEqual({ action: "subscribe", channel: "system.42" });
    connection.receive({ type: "subscribed", channel: "system.42" });
    expect(useLiveStatus.getState().status).toBe("connected");
  });

  it("re-subscribes serially after reconnect", () => {
    vi.useFakeTimers();
    const resync = vi.fn();
    const { socket, sockets } = setup({ onResync: resync });
    socket.subscribe("portfolio");
    socket.start();
    sockets[0].open();
    sockets[0].receive({ type: "auth.ok" });
    sockets[0].receive({ type: "subscribed", channel: "portfolio" });
    sockets[0].close(1006);
    vi.advanceTimersByTime(1_000);
    const replacement = sockets[1];
    replacement.open();
    replacement.receive({ type: "auth.ok" });
    expect(message(replacement, 1)).toEqual({ action: "subscribe", channel: "portfolio" });
    replacement.receive({ type: "subscribed", channel: "portfolio" });
    expect(resync).toHaveBeenCalledOnce();
  });

  it("caps reconnect backoff at thirty seconds", () => {
    vi.useFakeTimers();
    const { socket, sockets } = setup();
    socket.start();
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const current = sockets[attempt];
      current.close(1006);
      vi.advanceTimersByTime(Math.min(1_000 * 2 ** attempt, 30_000));
    }
    expect(sockets).toHaveLength(8);
  });

  it("reports sequence gaps after the baseline event", () => {
    const onGap = vi.fn();
    const { socket, sockets } = setup({ onGap });
    socket.subscribe("portfolio");
    socket.start();
    sockets[0].open();
    sockets[0].receive({ type: "auth.ok" });
    sockets[0].receive({ type: "subscribed", channel: "portfolio" });
    sockets[0].receive({ type: "alert", channel: "portfolio", seq: 4, time: "now", data: {} });
    sockets[0].receive({ type: "alert", channel: "portfolio", seq: 6, time: "now", data: {} });
    expect(onGap).toHaveBeenCalledWith("portfolio");
  });

  it("refreshes and re-authenticates when auth is expiring", async () => {
    let token = "old";
    const refresh = vi.fn(async () => {
      token = "new";
      return true;
    });
    const { socket, sockets } = setup({ accessToken: () => token, refresh });
    socket.start();
    sockets[0].open();
    sockets[0].receive({ type: "auth.ok" });
    sockets[0].receive({ type: "auth.expiring", in_s: 10 });
    await flush();
    expect(message(sockets[0], 1)).toEqual({ action: "auth", token: "new" });
    sockets[0].receive({ type: "auth.ok" });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("refreshes once before reconnecting after 4401", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn(async () => true);
    const { socket, sockets } = setup({ refresh });
    socket.start();
    sockets[0].close(4401);
    await flush();
    expect(refresh).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1_000);
    expect(sockets).toHaveLength(2);
  });

  it("drops a denied unacknowledged subscription after 4403", () => {
    vi.useFakeTimers();
    const { socket, sockets } = setup();
    socket.subscribe("portfolio");
    socket.subscribe("system.42");
    socket.start();
    sockets[0].open();
    sockets[0].receive({ type: "auth.ok" });
    sockets[0].receive({ type: "subscribed", channel: "portfolio" });
    sockets[0].close(4403);
    vi.advanceTimersByTime(1_000);
    sockets[1].open();
    sockets[1].receive({ type: "auth.ok" });
    expect(message(sockets[1], 1)).toEqual({ action: "subscribe", channel: "portfolio" });
  });

  it("drops subscriptions beyond the fifty-channel cap after 4429", () => {
    vi.useFakeTimers();
    const { socket, sockets } = setup();
    socket.subscribe("portfolio");
    for (let id = 0; id < 51; id += 1) socket.subscribe(`system.${id}`);
    socket.start();
    sockets[0].close(4429);
    vi.advanceTimersByTime(1_000);
    sockets[1].open();
    sockets[1].receive({ type: "auth.ok" });
    expect(message(sockets[1], 1)).toEqual({ action: "subscribe", channel: "portfolio" });
  });

  it("closes a connection when an acknowledgement misses its deadline", () => {
    vi.useFakeTimers();
    const { socket, sockets } = setup();
    socket.start();
    sockets[0].open();
    vi.advanceTimersByTime(5_000);
    expect(sockets[0].closed).toContain(4000);
  });
});
