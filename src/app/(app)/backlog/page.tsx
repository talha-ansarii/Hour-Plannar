import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/server/auth";
import { api, HydrateClient } from "@/trpc/server";
import { BacklogClient } from "@/features/pages/BacklogClient";

export default async function BacklogPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  await api.backlog.list.prefetch({ page: 1, pageSize: 20 });

  return (
    <HydrateClient>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Backlog</h1>
          <p className="text-sm text-muted-foreground">Deferred tasks you can restore into future days.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <BacklogClient />
          </CardContent>
        </Card>
      </div>
    </HydrateClient>
  );
}


