import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getTodayKeyInTimeZone } from "@/server/domain/dates";
import { api, HydrateClient } from "@/trpc/server";
import { DayClient } from "@/features/pages/DayClient";

export default async function TodayPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  });
  const today = getTodayKeyInTimeZone(user?.timezone ?? "UTC");

  await api.daily.ensureDailyLog({ date: today });
  await api.daily.getDay.prefetch({ date: today });

  return (
    <HydrateClient>
      <DayClient date={today} />
    </HydrateClient>
  );
}


