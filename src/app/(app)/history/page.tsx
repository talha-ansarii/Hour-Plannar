import { redirect } from "next/navigation";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const logs = await db.dailyLog.findMany({
    where: { userId: session.user.id },
    select: { date: true, score: true, sweptAt: true },
    orderBy: { date: "desc" },
    take: 60,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">Recent days (read-only).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No logs yet.</div>
          ) : null}
          <div className="divide-y rounded-md border">
            {logs.map((l) => (
              <Link
                key={l.date}
                href={`/history/${l.date}`}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50"
              >
                <span>{l.date}</span>
                <span className="text-muted-foreground">
                  {l.score != null ? `Score ${l.score}` : l.sweptAt ? "Swept" : "In progress"}
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


