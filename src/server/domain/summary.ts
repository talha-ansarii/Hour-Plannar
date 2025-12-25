import { type TodoStatus } from "../../../generated/prisma";

export type SummaryInput = {
  date: string;
  plannedByHour: Array<{ hour: number; text: string }>;
  reflectionByHour: Array<{ hour: number; text: string }>;
  todosByHour: Array<{
    hour: number;
    todos: Array<{
      title: string;
      status: TodoStatus;
      estimatedMinutes: number;
      actualMinutes: number | null;
    }>;
  }>;
  deferredCount: number;
};

function hourLabel(hour: number) {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  const ampm = h < 12 ? "AM" : "PM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${String(twelve).padStart(2, "0")}:00 ${ampm}`;
}

export function buildDeterministicSummary(input: SummaryInput) {
  const planned = input.plannedByHour
    .map((b) => ({ ...b, text: b.text.trim() }))
    .filter((b) => b.text.length > 0);

  const reflections = input.reflectionByHour
    .map((b) => ({ ...b, text: b.text.trim() }))
    .filter((b) => b.text.length > 0);

  const completed = input.todosByHour
    .flatMap((h) =>
      h.todos
        .filter((t) => t.status === "DONE")
        .map((t) => ({
          hour: h.hour,
          title: t.title.trim(),
          estimatedMinutes: t.estimatedMinutes,
          actualMinutes: t.actualMinutes,
        })),
    )
    .filter((t) => t.title.length > 0);

  const lines: string[] = [];
  lines.push(`Daily Summary (${input.date})`);
  lines.push("");

  lines.push("Plan");
  if (planned.length === 0) {
    lines.push("- (No planned blocks)");
  } else {
    for (const p of planned) {
      lines.push(`- ${hourLabel(p.hour)} — ${p.text}`);
    }
  }
  lines.push("");

  lines.push("Completed");
  if (completed.length === 0) {
    lines.push("- (No completed tasks)");
  } else {
    for (const t of completed) {
      const timeBits: string[] = [];
      if (Number.isFinite(t.estimatedMinutes) && t.estimatedMinutes > 0) {
        timeBits.push(`est ${t.estimatedMinutes}m`);
      }
      if (t.actualMinutes != null && Number.isFinite(t.actualMinutes) && t.actualMinutes > 0) {
        timeBits.push(`act ${t.actualMinutes}m`);
      }
      const suffix = timeBits.length ? ` (${timeBits.join(", ")})` : "";
      lines.push(`- ${hourLabel(t.hour)} — ${t.title}${suffix}`);
    }
  }
  lines.push("");

  lines.push("Reflection");
  if (reflections.length === 0) {
    lines.push("- (No reflections)");
  } else {
    for (const r of reflections) {
      lines.push(`- ${hourLabel(r.hour)} — ${r.text}`);
    }
  }

  lines.push("");
  lines.push(`Deferred to Backlog: ${input.deferredCount}`);

  return lines.join("\n");
}


