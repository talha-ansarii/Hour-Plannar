"use client";

import { useEffect } from "react";

import { api } from "@/trpc/react";
import { DayPageShell } from "@/features/day/DayPageShell";

export function DayClient(props: { date: string }) {
  const day = api.daily.getDay.useQuery({ date: props.date });
  const utils = api.useUtils();
  const setTimezone = api.user.setTimezone.useMutation({
    onSuccess: async () => {
      await utils.daily.getDay.invalidate({ date: props.date });
    },
  });

  // Sync DB timezone with the browser timezone so server-rendered “today” and UI clocks match the user.
  // This fixes cases where the default timezone is UTC.
  useEffect(() => {
    if (!day.data?.timeZone) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    if (tz === day.data.timeZone) return;
    if (setTimezone.isPending) return;
    setTimezone.mutate({ timeZone: tz });
  }, [day.data?.timeZone, setTimezone]);

  if (day.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (day.error) return <div className="text-sm text-destructive">{day.error.message}</div>;
  if (!day.data) return <div className="text-sm text-muted-foreground">No data.</div>;

  const mode =
    day.data.dailyLog.date < day.data.today
      ? "history"
      : day.data.dailyLog.date === day.data.today
        ? "execution"
        : "planning";

  return (
    <DayPageShell
      date={props.date}
      mode={mode}
      today={day.data.today}
      timeZone={day.data.timeZone}
      dailyLog={day.data.dailyLog}
      blocks={day.data.blocks}
    />
  );
}


