import { PlaceholderPage } from "@/components/placeholder-page";
import { BacktestProof } from "@/components/page-wiring";
export default async function BacktestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlaceholderPage title={`Backtest #${id}`}>
      <BacktestProof />
    </PlaceholderPage>
  );
}
