import { PlaceholderPage } from "@/components/placeholder-page";
import { AccountProof } from "@/components/page-wiring";
export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlaceholderPage title={`Account #${id}`}>
      <AccountProof />
    </PlaceholderPage>
  );
}
