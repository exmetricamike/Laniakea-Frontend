"use client";

import { useParams } from "next/navigation";
import { useMode } from "@/components/app-shell";
import { DataProof } from "@/components/data-proof";
import {
  useAccounts,
  useBacktest,
  useBacktests,
  useInstruments,
  useKillSwitches,
  useMe,
  useOperatorSystems,
  usePortfolioSummary,
  useStrategies,
  useSystem,
  useSystems,
} from "@/lib/api/queries";

export function PortfolioProof() {
  const mode = useMode((state) => state.mode);
  const query = usePortfolioSummary(mode, "today");
  return (
    <DataProof {...query}>
      {query.data?.buckets?.length ?? 0} buckets · {query.data?.systems?.length ?? 0} systems
    </DataProof>
  );
}
export function SystemsProof() {
  const mode = useMode((state) => state.mode);
  const query = useSystems({ mode });
  return <DataProof {...query}>{query.data?.results?.length ?? 0} systems</DataProof>;
}
export function SystemProof() {
  const params = useParams<{ id: string }>();
  const query = useSystem(Number(params.id));
  return (
    <DataProof {...query}>
      {query.data ? `${query.data.name} · ${query.data.state}` : null}
    </DataProof>
  );
}
export function NewSystemProof() {
  const strategy = useStrategies();
  const account = useAccounts();
  const instrument = useInstruments({ venue: "binance", page_size: 5 });
  const error = strategy.error ?? account.error ?? instrument.error;
  return (
    <DataProof
      loading={strategy.isLoading || account.isLoading || instrument.isLoading}
      error={error}
      retry={() => {
        strategy.refetch();
        account.refetch();
        instrument.refetch();
      }}
    >
      {strategy.data?.results.length ?? 0} strategies · {account.data?.results.length ?? 0} accounts
      · first instruments: {instrument.data?.results.map((item) => item.symbol).join(", ")}
    </DataProof>
  );
}
export function BacktestsProof() {
  const query = useBacktests({});
  return <DataProof {...query}>{query.data?.results?.length ?? 0} backtests</DataProof>;
}
export function BacktestProof() {
  const params = useParams<{ id: string }>();
  const query = useBacktest(Number(params.id));
  return (
    <DataProof {...query}>
      {query.data ? `${String(query.data.strategy)} · ${query.data.status}` : null}
    </DataProof>
  );
}
export function NewBacktestProof() {
  const query = useStrategies();
  return <DataProof {...query}>{query.data?.results?.length ?? 0} strategies available</DataProof>;
}
export function RiskProof() {
  const query = useKillSwitches();
  return <DataProof {...query}>{query.data?.results?.length ?? 0} kill switches</DataProof>;
}
export function OperatorProof() {
  const query = useOperatorSystems();
  return <DataProof {...query}>{query.data?.results?.length ?? 0} systems (all tenants)</DataProof>;
}
export function SettingsProof() {
  const query = useMe();
  return <DataProof {...query}>{query.data?.email}</DataProof>;
}
