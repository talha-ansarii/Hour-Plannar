"use client";

import { api } from "@/trpc/react";
import { Heatmap } from "@/features/analytics/Heatmap";
import { StreakCard } from "@/features/analytics/StreakCard";
import { WeeklyScoreCard } from "@/features/analytics/WeeklyScoreCard";

export function AnalyticsClient() {
  const weekly = api.analytics.weeklyScore.useQuery();
  const heatmap = api.analytics.heatmap.useQuery();
  const streak = api.analytics.streak.useQuery();

  if (weekly.isLoading || heatmap.isLoading || streak.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }
  if (weekly.error) return <div className="text-sm text-destructive">{weekly.error.message}</div>;
  if (heatmap.error) return <div className="text-sm text-destructive">{heatmap.error.message}</div>;
  if (streak.error) return <div className="text-sm text-destructive">{streak.error.message}</div>;

  if (!weekly.data || !heatmap.data || !streak.data) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <StreakCard streak={streak.data.streak} endsOn={streak.data.endsOn} />
        <div className="md:col-span-2">
          <WeeklyScoreCard
            weekStart={weekly.data.weekStart}
            weekEnd={weekly.data.weekEnd}
            averageScore={weekly.data.averageScore}
            days={weekly.data.days}
          />
        </div>
      </div>

      <Heatmap days={heatmap.data.days} />
    </div>
  );
}


