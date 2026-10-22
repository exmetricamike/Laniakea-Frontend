import { PlaceholderPage } from "@/components/placeholder-page";
import { SystemProof } from "@/components/page-wiring";
export default async function SystemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlaceholderPage title={`System #${id}`}>
      <SystemProof />
    </PlaceholderPage>
  );
}
