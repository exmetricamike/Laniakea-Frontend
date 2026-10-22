import { Card, CardContent } from "@/components/ui/card";
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <Card>
        <CardContent className="p-6 text-sm text-[var(--muted-foreground)]">
          Coming in a later work package
        </CardContent>
      </Card>
    </div>
  );
}
