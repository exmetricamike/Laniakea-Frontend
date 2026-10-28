"use client";

import { useLiveStatus, type LiveStatus } from "@/lib/ws/socket";

export type LivePollIntervals = {
  connecting: number | false;
  paused: number | false;
};

export function livePollInterval(status: LiveStatus, intervals: LivePollIntervals): number | false {
  if (status === "connected") return false;
  return intervals[status];
}

export function useLivePollInterval(intervals: LivePollIntervals): number | false {
  const status = useLiveStatus((state) => state.status);
  return livePollInterval(status, intervals);
}
