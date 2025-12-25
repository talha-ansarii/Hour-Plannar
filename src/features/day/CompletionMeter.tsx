"use client";

import { Progress } from "@/components/ui/progress";

export function CompletionMeter(props: { done: number; total: number }) {
  const pct =
    props.total <= 0 ? 0 : Math.max(0, Math.min(100, (props.done / props.total) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {props.done}/{props.total} done
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      <Progress value={pct} />
    </div>
  );
}


