import { notFound, redirect } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { api, HydrateClient } from "@/trpc/server";
import { DayClient } from "@/features/pages/DayClient";

function isDateKey(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default async function HistoryDatePage(props: { params: Promise<{ date: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const { date } = await props.params;
  if (!isDateKey(date)) notFound();

  // Do not auto-create logs in history.
  const exists = await db.dailyLog.findUnique({
    where: { userId_date: { userId: session.user.id, date } },
    select: { id: true },
  });

  if (!exists) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No log exists for {date}.
        </CardContent>
      </Card>
    );
  }

  await api.daily.getDay.prefetch({ date });

  return (
    <HydrateClient>
      <DayClient date={date} />
    </HydrateClient>
  );
}


