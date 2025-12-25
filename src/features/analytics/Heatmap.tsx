"use client";

type HeatmapDay = { date: string; score: number | null };

function weekdayMon0(dateKey: string) {
  const dt = new Date(`${dateKey}T00:00:00Z`);
  const d = dt.getUTCDay(); // 0..6 Sun..Sat
  return d === 0 ? 6 : d - 1; // Mon=0 .. Sun=6
}

function scoreClass(score: number | null) {
  if (score == null) return "bg-muted/40";
  if (score >= 90) return "bg-emerald-500/70";
  if (score >= 75) return "bg-emerald-500/45";
  if (score >= 50) return "bg-amber-500/45";
  if (score >= 25) return "bg-amber-500/30";
  return "bg-rose-500/30";
}

export function Heatmap(props: { days: HeatmapDay[] }) {
  // Render as week-columns with 7 rows (Mon..Sun)
  const startOffset = props.days.length ? weekdayMon0(props.days[0]!.date) : 0;
  const padded: Array<HeatmapDay | null> = [
    ...Array.from({ length: startOffset }, () => null),
    ...props.days,
  ];
  const cols = Math.ceil(padded.length / 7);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Last {props.days.length} days</div>
      <div className="overflow-x-auto">
        <div
          className="grid gap-1"
          style={{
            gridAutoFlow: "column",
            gridTemplateRows: "repeat(7, 12px)",
            gridAutoColumns: "12px",
          }}
        >
          {Array.from({ length: cols * 7 }, (_, i) => {
            const cell = padded[i] ?? null;
            return (
              <div
                key={i}
                title={cell ? `${cell.date} — ${cell.score ?? "—"}` : ""}
                className={`h-3 w-3 rounded-sm border ${cell ? scoreClass(cell.score) : "bg-transparent border-transparent"}`}
              />
            );
          })}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Colors represent score intensity; empty means no score recorded.
      </div>
    </div>
  );
}


