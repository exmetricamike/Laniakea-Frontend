import { PlaceholderPage } from "@/components/placeholder-page";
export default async function StrategyPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <PlaceholderPage title={`Strategy ${decodeURIComponent(key)}`} />;
}
