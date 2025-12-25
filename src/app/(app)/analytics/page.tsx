import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/server/auth";
import { api, HydrateClient } from "@/trpc/server";
import { AnalyticsClient } from "@/features/pages/AnalyticsClient";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  await api.analytics.weeklyScore.prefetch();
  await api.analytics.heatmap.prefetch();
  await api.analytics.streak.prefetch();

  return (
    <HydrateClient>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Weekly score, streak, and recent history.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalyticsClient />
          </CardContent>
        </Card>
      </div>
    </HydrateClient>
  );
}


