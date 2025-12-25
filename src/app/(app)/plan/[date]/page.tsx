import { notFound, redirect } from "next/navigation";

import { DayClient } from "@/features/pages/DayClient";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getTodayKeyInTimeZone } from "@/server/domain/dates";
import { api, HydrateClient } from "@/trpc/server";

function isDateKey(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default async function PlanDatePage(props: { params: Promise<{ date: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const { date } = await props.params;
  if (!isDateKey(date)) notFound();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  });
  const today = getTodayKeyInTimeZone(user?.timezone ?? "UTC");

  // Planning is allowed for future days (and for today, execution is handled at /today).
  if (date === today) redirect("/today");

  await api.daily.ensureDailyLog({ date });
  await api.daily.getDay.prefetch({ date });

  return (
    <HydrateClient>
      <DayClient date={date} />
    </HydrateClient>
  );
}


