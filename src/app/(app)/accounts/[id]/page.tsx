import { PlaceholderPage } from "@/components/placeholder-page";
export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlaceholderPage title={`Account #${id}`} />;
}
