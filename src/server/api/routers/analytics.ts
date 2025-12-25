import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  addDays,
  getIsoWeekEndSunday,
  getIsoWeekStartMonday,
  getTodayKeyInTimeZone,
  listDateKeysInclusive,
} from "@/server/domain/dates";

export const analyticsRouter = createTRPCRouter({
  weeklyScore: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    const today = getTodayKeyInTimeZone(user.timezone);
    const weekStart = getIsoWeekStartMonday(today);
    const weekEnd = getIsoWeekEndSunday(today);

    const logs = await ctx.db.dailyLog.findMany({
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
      select: { date: true, score: true, sweptAt: true },
    });
    const map = new Map(logs.map((l) => [l.date, l]));
    const days = listDateKeysInclusive(weekStart, weekEnd).map((date) => {
      const l = map.get(date);
      return { date, score: l?.score ?? null, sweptAt: l?.sweptAt ?? null };
    });

    const scored = days.map((d) => d.score).filter((v): v is number => v != null);
    const averageScore =
      scored.length === 0 ? null : Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);

    return { weekStart, weekEnd, days, averageScore };
  }),

  heatmap: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    const today = getTodayKeyInTimeZone(user.timezone);
    const start = addDays(today, -90);

    const logs = await ctx.db.dailyLog.findMany({
      where: { userId, date: { gte: start, lte: today } },
      select: { date: true, score: true },
    });
    const map = new Map(logs.map((l) => [l.date, l.score]));

    const days = listDateKeysInclusive(start, today).map((date) => ({
      date,
      score: map.get(date) ?? null,
    }));

    return { start, end: today, days };
  }),

  streak: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

    const today = getTodayKeyInTimeZone(user.timezone);
    const yesterday = addDays(today, -1);

    const logs = await ctx.db.dailyLog.findMany({
      where: { userId, date: { lt: today }, score: { not: null } },
      select: { date: true, score: true },
      orderBy: { date: "desc" },
      take: 400,
    });

    const scoredDates = new Set(logs.map((l) => l.date));
    let count = 0;
    let cursor = yesterday;
    while (scoredDates.has(cursor)) {
      count += 1;
      cursor = addDays(cursor, -1);
    }

    return { streak: count, endsOn: yesterday };
  }),
});


