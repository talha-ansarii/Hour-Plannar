import {
  DailyLogStatus,
  TodoStatus,
  type PrismaClient,
} from "../../../generated/prisma";

import { computeDailyScore } from "@/server/domain/scoring";
import {
  assertDateKey,
  type DateKey,
  isBefore,
  listDateKeysInclusive,
} from "@/server/domain/dates";
import { buildDeterministicSummary } from "@/server/domain/summary";

export async function sweepDayIfNeeded(input: {
  db: PrismaClient;
  userId: string;
  date: DateKey;
}) {
  assertDateKey(input.date);

  const day = await input.db.dailyLog.findUnique({
    where: { userId_date: { userId: input.userId, date: input.date } },
    include: {
      hourBlocks: { select: { hour: true, plannedText: true, reflectionText: true } },
      todos: {
        select: {
          id: true,
          title: true,
          status: true,
          estimatedMinutes: true,
          actualMinutes: true,
          hourBlock: { select: { hour: true } },
        },
        orderBy: [{ hourBlock: { hour: "asc" } }, { sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!day) return { didSweep: false as const, deferredCount: 0 };
  if (day.sweptAt) return { didSweep: false as const, deferredCount: 0 };

  const pending = day.todos.filter((t) => t.status === TodoStatus.PENDING);
  const done = day.todos.filter((t) => t.status === TodoStatus.DONE);

  const totalEstimatedMinutes = day.todos.reduce(
    (acc, t) => acc + (t.estimatedMinutes ?? 0),
    0,
  );
  const completedEstimatedMinutes = done.reduce(
    (acc, t) => acc + (t.estimatedMinutes ?? 0),
    0,
  );
  const score = computeDailyScore({
    totalEstimatedMinutes,
    completedEstimatedMinutes,
    completedCount: done.length,
  });

  const plannedByHour = day.hourBlocks.map((b) => ({
    hour: b.hour,
    text: b.plannedText,
  }));
  const reflectionByHour = day.hourBlocks.map((b) => ({
    hour: b.hour,
    text: b.reflectionText,
  }));

  const todosByHourMap = new Map<
    number,
    Array<{
      title: string;
      status: TodoStatus;
      estimatedMinutes: number;
      actualMinutes: number | null;
    }>
  >();
  for (const t of day.todos) {
    const hour = t.hourBlock.hour;
    const list = todosByHourMap.get(hour) ?? [];
    list.push({
      title: t.title,
      status: t.status,
      estimatedMinutes: t.estimatedMinutes,
      actualMinutes: t.actualMinutes,
    });
    todosByHourMap.set(hour, list);
  }

  const todosByHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    todos: todosByHourMap.get(hour) ?? [],
  }));

  const summary = buildDeterministicSummary({
    date: day.date,
    plannedByHour,
    reflectionByHour,
    todosByHour,
    deferredCount: pending.length,
  });

  await input.db.$transaction(async (tx) => {
    if (pending.length > 0) {
      await tx.backlogItem.createMany({
        data: pending.map((t) => ({
          userId: input.userId,
          title: t.title,
          estimatedMinutes: t.estimatedMinutes,
          actualMinutes: t.actualMinutes,
          sourceDate: day.date,
          sourceHour: t.hourBlock.hour,
        })),
      });

      await tx.todo.deleteMany({
        where: { id: { in: pending.map((t) => t.id) } },
      });
    }

    await tx.dailyLog.update({
      where: { id: day.id },
      data: {
        status: DailyLogStatus.HISTORY,
        isLocked: true,
        sweptAt: new Date(),
        score: day.score ?? score,
        summary: day.summary ?? summary,
      },
    });
  });

  return { didSweep: true as const, deferredCount: pending.length };
}

export async function sweepAllPastUnsweptDays(input: {
  db: PrismaClient;
  userId: string;
  today: DateKey;
}) {
  assertDateKey(input.today);

  const candidates = await input.db.dailyLog.findMany({
    where: {
      userId: input.userId,
      sweptAt: null,
      date: { lt: input.today },
    },
    select: { date: true },
    orderBy: { date: "asc" },
  });

  let swept = 0;
  for (const c of candidates) {
    if (!isBefore(c.date, input.today)) continue;
    const res = await sweepDayIfNeeded({
      db: input.db,
      userId: input.userId,
      date: c.date,
    });
    if (res.didSweep) swept += 1;
  }
  return swept;
}

export async function ensureWeekSweptUpTo(input: {
  db: PrismaClient;
  userId: string;
  start: DateKey;
  end: DateKey;
}) {
  assertDateKey(input.start);
  assertDateKey(input.end);

  const dates = listDateKeysInclusive(input.start, input.end);
  for (const date of dates) {
    await sweepDayIfNeeded({ db: input.db, userId: input.userId, date });
  }
}


