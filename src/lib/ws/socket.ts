"use client";

import { useEffect } from "react";
import { create } from "zustand";
import {
  handleSessionExpired,
  refreshAccessToken,
  registerSessionExpired,
} from "@/lib/api/client";
import { getAccess } from "@/lib/auth";
import { parseServerFrame, type EngineEvent } from "@/lib/ws/events";

export type LiveStatus = "connected" | "connecting" | "paused";

type LiveStatusState = {
  status: LiveStatus;
  setStatus: (status: LiveStatus) => void;
};

export const useLiveStatus = create<LiveStatusState>((set) => ({
  status: "connecting",
  setStatus: (status) => set({ status }),
}));

export type SocketLike = {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  send: (data: string) => void;
  close: (code?: number) => void;
};

export type SocketFactory = (url: string) => SocketLike;

type Timer = ReturnType<typeof setTimeout>;

type EngineSocketOptions = {
  createSocket?: SocketFactory;
  accessToken?: () => string | null;
  refresh?: () => Promise<boolean>;
  expireSession?: () => void;
  random?: () => number;
  onEvent?: (event: EngineEvent) => void;
  onGap?: (channel: string) => void;
  onResync?: () => void;
};

type DesiredChannel = { count: number; order: number };

const AUTH_TIMEOUT_MS = 5_000;
const PAUSE_TIMEOUT_MS = 10_000;
const MAX_BACKOFF_MS = 30_000;
const MAX_SUBSCRIPTIONS = 50;

function socketUrl(): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (configured) return configured;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const url = new URL(apiUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/engine/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function defaultSocketFactory(url: string): SocketLike {
  return new WebSocket(url);
}

function isEngineEvent(value: ReturnType<typeof parseServerFrame>): value is EngineEvent {
  return value !== "invalid" && "seq" in value && "data" in value;
}

export class EngineSocket {
  private readonly createSocket: SocketFactory;
  private readonly accessToken: () => string | null;
  private readonly refresh: () => Promise<boolean>;
  private readonly expireSession: () => void;
  private readonly random: () => number;
  private readonly onEvent: (event: EngineEvent) => void;
  private readonly onGap: (channel: string) => void;
  private readonly onResync: () => void;
  private readonly desired = new Map<string, DesiredChannel>();
  private readonly acknowledged = new Set<string>();
  private readonly sequences = new Map<string, number>();
  private socket: SocketLike | null = null;
  private authTimer: Timer | null = null;
  private subscriptionTimer: Timer | null = null;
  private pauseTimer: Timer | null = null;
  private reconnectTimer: Timer | null = null;
  private pendingChannel: string | null = null;
  private nextOrder = 0;
  private retryAttempt = 0;
  private destroyed = false;
  private reconnecting = false;
  private authenticated = false;
  private awaitingReauth = false;
  private invalidLogged = false;

  constructor(options: EngineSocketOptions = {}) {
    this.createSocket = options.createSocket ?? defaultSocketFactory;
    this.accessToken = options.accessToken ?? getAccess;
    this.refresh = options.refresh ?? refreshAccessToken;
    this.expireSession = options.expireSession ?? handleSessionExpired;
    this.random = options.random ?? Math.random;
    this.onEvent = options.onEvent ?? (() => {});
    this.onGap = options.onGap ?? (() => {});
    this.onResync = options.onResync ?? (() => {});
  }

  start(): void {
    this.destroyed = false;
    this.connect();
  }

  destroy(): void {
    this.destroyed = true;
    this.desired.clear();
    this.acknowledged.clear();
    this.sequences.clear();
    this.clearTimers();
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000);
    useLiveStatus.getState().setStatus("connecting");
  }

  subscribe(channel: string): () => void {
    const current = this.desired.get(channel);
    this.desired.set(channel, {
      count: (current?.count ?? 0) + 1,
      order: current?.order ?? ++this.nextOrder,
    });
    this.sendNextSubscription();
    return () => this.unsubscribe(channel);
  }

  private unsubscribe(channel: string): void {
    const current = this.desired.get(channel);
    if (!current) return;
    if (current.count > 1) {
      this.desired.set(channel, { ...current, count: current.count - 1 });
      return;
    }
    this.desired.delete(channel);
    this.acknowledged.delete(channel);
    this.sequences.delete(channel);
    if (this.pendingChannel === channel) {
      this.clearSubscriptionTimer();
      this.pendingChannel = null;
    }
    this.send({ action: "unsubscribe", channel });
    this.sendNextSubscription();
  }

  private connect(): void {
    if (this.destroyed || this.socket || this.reconnectTimer) return;
    this.setConnecting();
    try {
      const socket = this.createSocket(socketUrl());
      this.socket = socket;
      socket.onopen = () => this.authenticate();
      socket.onmessage = (event) => this.receive(event.data);
      socket.onclose = (event) => {
        if (this.socket === socket) this.socket = null;
        void this.closed(event.code);
      };
      socket.onerror = () => socket.close(4000);
    } catch {
      this.scheduleReconnect();
    }
  }

  private authenticate(): void {
    const token = this.accessToken();
    if (!token) {
      this.expireSession();
      return;
    }
    this.send({ action: "auth", token });
    this.waitForAuth();
  }

  private async renewAuthentication(): Promise<void> {
    const refreshed = await this.refresh();
    if (!refreshed || this.destroyed || !this.socket) return;
    const token = this.accessToken();
    if (!token) {
      this.expireSession();
      return;
    }
    this.awaitingReauth = true;
    this.send({ action: "auth", token });
    this.waitForAuth();
  }

  private receive(raw: unknown): void {
    const frame = parseServerFrame(raw);
    if (frame === "invalid") {
      if (!this.invalidLogged) {
        this.invalidLogged = true;
        console.warn("Ignored invalid engine WebSocket frame");
      }
      return;
    }
    if (isEngineEvent(frame)) {
      this.receiveEvent(frame);
      return;
    }
    if (frame.type === "auth.ok") {
      this.clearAuthTimer();
      this.authenticated = true;
      if (this.awaitingReauth) {
        this.awaitingReauth = false;
        useLiveStatus.getState().setStatus("connected");
        return;
      }
      this.acknowledged.clear();
      this.pendingChannel = null;
      this.sendNextSubscription();
      return;
    }
    if (frame.type === "auth.expiring") {
      void this.renewAuthentication();
      return;
    }
    if (frame.type === "subscribed" && frame.channel === this.pendingChannel) {
      this.clearSubscriptionTimer();
      this.acknowledged.add(frame.channel);
      this.pendingChannel = null;
      this.sendNextSubscription();
      return;
    }
  }

  private receiveEvent(event: EngineEvent): void {
    const last = this.sequences.get(event.channel);
    if (last !== undefined && event.seq !== last + 1) this.onGap(event.channel);
    this.sequences.set(event.channel, event.seq);
    this.onEvent(event);
  }

  private sendNextSubscription(): void {
    if (!this.socket || !this.authenticated || this.pendingChannel || this.awaitingReauth) return;
    const next = [...this.desired.entries()]
      .filter(([channel]) => !this.acknowledged.has(channel))
      .sort(([, left], [, right]) => left.order - right.order)[0]?.[0];
    if (!next) {
      this.connected();
      return;
    }
    this.pendingChannel = next;
    this.send({ action: "subscribe", channel: next });
    this.subscriptionTimer = setTimeout(() => {
      this.socket?.close(4000);
    }, AUTH_TIMEOUT_MS);
  }

  private connected(): void {
    this.retryAttempt = 0;
    this.clearPauseTimer();
    useLiveStatus.getState().setStatus("connected");
    if (this.reconnecting) {
      this.reconnecting = false;
      this.onResync();
    }
  }

  private waitForAuth(): void {
    this.clearAuthTimer();
    this.authTimer = setTimeout(() => {
      this.socket?.close(4000);
    }, AUTH_TIMEOUT_MS);
  }

  private async closed(code: number): Promise<void> {
    const pendingChannel = this.pendingChannel;
    this.clearAuthTimer();
    this.clearSubscriptionTimer();
    this.pendingChannel = null;
    this.acknowledged.clear();
    this.sequences.clear();
    this.authenticated = false;
    if (this.destroyed) return;
    if (code === 4401) {
      const refreshed = await this.refresh();
      if (refreshed) this.scheduleReconnect();
      return;
    }
    if (code === 4403) {
      if (pendingChannel && pendingChannel !== "portfolio") {
        this.desired.delete(pendingChannel);
        console.warn(`Engine WebSocket subscription denied: ${pendingChannel}`);
        this.scheduleReconnect();
        return;
      }
      this.expireSession();
      return;
    }
    if (code === 4429) {
      this.dropExcessSubscriptions();
    }
    this.scheduleReconnect();
  }

  private dropExcessSubscriptions(): void {
    const entries = [...this.desired.entries()].sort(
      ([, left], [, right]) => right.order - left.order,
    );
    const keep = new Set<string>(["portfolio"]);
    entries.forEach(([channel]) => {
      if (keep.size < MAX_SUBSCRIPTIONS) keep.add(channel);
    });
    for (const channel of this.desired.keys()) {
      if (!keep.has(channel)) this.desired.delete(channel);
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer) return;
    this.setConnecting();
    const rawDelay = Math.min(1_000 * 2 ** this.retryAttempt, MAX_BACKOFF_MS);
    this.retryAttempt += 1;
    const delay = rawDelay * (0.8 + this.random() * 0.4);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnecting = true;
      this.connect();
    }, delay);
  }

  private setConnecting(): void {
    if (useLiveStatus.getState().status !== "paused") {
      useLiveStatus.getState().setStatus("connecting");
    }
    if (!this.pauseTimer) {
      this.pauseTimer = setTimeout(() => {
        if (!this.destroyed && useLiveStatus.getState().status !== "connected") {
          useLiveStatus.getState().setStatus("paused");
        }
      }, PAUSE_TIMEOUT_MS);
    }
  }

  private send(payload: Record<string, string>): void {
    this.socket?.send(JSON.stringify(payload));
  }

  private clearAuthTimer(): void {
    if (!this.authTimer) return;
    clearTimeout(this.authTimer);
    this.authTimer = null;
  }

  private clearSubscriptionTimer(): void {
    if (!this.subscriptionTimer) return;
    clearTimeout(this.subscriptionTimer);
    this.subscriptionTimer = null;
  }

  private clearPauseTimer(): void {
    if (!this.pauseTimer) return;
    clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
  }

  private clearTimers(): void {
    this.clearAuthTimer();
    this.clearSubscriptionTimer();
    this.clearPauseTimer();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}

let singleton: EngineSocket | null = null;

export function startLiveSocket(): EngineSocket {
  singleton ??= new EngineSocket();
  singleton.start();
  return singleton;
}

export function destroyLiveSocket(): void {
  singleton?.destroy();
  singleton = null;
}

export function useLiveChannel(channel: string, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    return (singleton ?? startLiveSocket()).subscribe(channel);
  }, [channel, enabled]);
}

export function LiveSocketProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const socket = startLiveSocket();
    const unsubscribe = socket.subscribe("portfolio");
    const unregister = registerSessionExpired(destroyLiveSocket);
    return () => {
      unregister();
      unsubscribe();
      destroyLiveSocket();
    };
  }, []);
  return children;
}

export const __socketUrlForTests = socketUrl;

