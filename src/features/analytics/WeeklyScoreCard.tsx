"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WeeklyScoreCard(props: {
  weekStart: string;
  weekEnd: string;
  averageScore: number | null;
  days: Array<{ date: string; score: number | null }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Weekly score (ISO week)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          {props.weekStart} → {props.weekEnd}
        </div>
        <div className="text-2xl font-semibold">{props.averageScore ?? "—"}</div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
          {props.days.map((d) => (
            <a
              key={d.date}
              href={`/history/${d.date}`}
              className="rounded-md border p-2 hover:bg-muted/50"
            >
              <div className="text-xs text-muted-foreground">{d.date}</div>
              <div className="text-lg font-semibold">{d.score ?? "—"}</div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


