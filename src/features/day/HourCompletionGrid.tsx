"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";

type Block = {
  id: string;
  hour: number;
  doneCount: number;
  totalCount: number;
};

function hourLabel(hour: number) {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  const ampm = h < 12 ? "AM" : "PM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${String(twelve).padStart(2, "0")}:00 ${ampm}`;
}

function cellClass(done: number, total: number) {
  if (total <= 0) return "bg-muted/40 border-border/60";
  const pct = done / total;
  if (pct >= 1) return "bg-emerald-500/80 border-emerald-600/40";
  if (pct >= 0.66) return "bg-emerald-500/50 border-emerald-600/30";
  if (pct >= 0.33) return "bg-emerald-500/30 border-emerald-600/20";
  return "bg-emerald-500/15 border-emerald-600/15";
}

export function HourCompletionGrid(props: { blocks: Block[] }) {
  const blocks = useMemo(
    () => props.blocks.slice().sort((a, b) => a.hour - b.hour),
    [props.blocks],
  );

  // 24 cells laid out like GitHub: compact squares, wraps naturally.
  return (
    <div className="grid grid-cols-6 gap-1">
      {blocks.map((b) => (
        <a
          key={b.id}
          href={`#hour-${b.hour}`}
          className={cn(
            "h-3 w-3 rounded-sm border transition hover:scale-110",
            cellClass(b.doneCount, b.totalCount),
          )}
          title={`${hourLabel(b.hour)} — ${b.doneCount}/${b.totalCount}`}
          aria-label={`${hourLabel(b.hour)} completion ${b.doneCount} of ${b.totalCount}`}
        />
      ))}
    </div>
  );
}


