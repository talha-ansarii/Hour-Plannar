import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  assertDateKey,
  getTodayKeyInTimeZone,
} from "@/server/domain/dates";
import { ensureDailyLogWith24Blocks, resolveDailyStatus } from "@/server/domain/daily";
import { sweepAllPastUnsweptDays } from "@/server/domain/sweep";
import { buildDeterministicSummary } from "@/server/domain/summary";
import { computeDailyScore } from "@/server/domain/scoring";
import { rewriteSummaryWithGemini } from "@/server/integrations/openai";
import { TodoStatus } from "../../../../generated/prisma";

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const dailyRouter = createTRPCRouter({
  ensureDailyLog: protectedProcedure
    .input(z.object({ date: dateKeySchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const today = getTodayKeyInTimeZone(user.timezone);
      const date = input.date;
      assertDateKey(date);

      const dailyLog = await ctx.db.$transaction(async (tx) => {
        return await ensureDailyLogWith24Blocks(tx, {
          userId,
          date,
          today,
        });
      });

      if (date === today) {
        await sweepAllPastUnsweptDays({ db: ctx.db, userId, today });
      }

      return { id: dailyLog.id };
    }),

  lockDay: protectedProcedure
    .input(z.object({ date: dateKeySchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const day = await ctx.db.dailyLog.findUnique({
        where: { userId_date: { userId, date: input.date } },
        select: { id: true },
      });
      if (!day) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.dailyLog.update({
        where: { id: day.id },
        data: { isLocked: true },
      });
      return { ok: true };
    }),

  unlockDay: protectedProcedure
    .input(z.object({ date: dateKeySchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const day = await ctx.db.dailyLog.findUnique({
        where: { userId_date: { userId, date: input.date } },
        select: { id: true },
      });
      if (!day) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.dailyLog.update({
        where: { id: day.id },
        data: { isLocked: false },
      });
      return { ok: true };
    }),

  getDay: protectedProcedure
    .input(z.object({ date: dateKeySchema }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const today = getTodayKeyInTimeZone(user.timezone);
      const date = input.date;
      assertDateKey(date);

      const dailyLog = await ctx.db.dailyLog.findUnique({
        where: { userId_date: { userId, date } },
        include: {
          hourBlocks: {
            orderBy: { hour: "asc" },
            include: {
              todos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
            },
          },
        },
      });

      if (!dailyLog) throw new TRPCError({ code: "NOT_FOUND" });

      // Backfill blocks if schema/data drift exists; do not auto-create a DailyLog here.
      if (dailyLog.hourBlocks.length !== 24) {
        const existing = new Set(dailyLog.hourBlocks.map((b) => b.hour));
        const missing = Array.from({ length: 24 }, (_, h) => h).filter(
          (h) => !existing.has(h),
        );
        if (missing.length > 0) {
          await ctx.db.hourBlock.createMany({
            data: missing.map((hour) => ({
              dailyLogId: dailyLog.id,
              hour,
              plannedText: "",
              reflectionText: "",
            })),
            skipDuplicates: true,
          });
        }
      }

      const status = resolveDailyStatus(date, today);
      if (dailyLog.status !== status) {
        await ctx.db.dailyLog.update({
          where: { id: dailyLog.id },
          data: { status },
        });
      }

      const blocks = dailyLog.hourBlocks.map((b) => {
        const estimatedTotal = b.todos.reduce((acc, t) => acc + t.estimatedMinutes, 0);
        const doneEstimated = b.todos
          .filter((t) => t.status === TodoStatus.DONE)
          .reduce((acc, t) => acc + t.estimatedMinutes, 0);
        const doneCount = b.todos.filter((t) => t.status === TodoStatus.DONE).length;
        const totalCount = b.todos.length;

        return {
          id: b.id,
          hour: b.hour,
          plannedText: b.plannedText,
          reflectionText: b.reflectionText,
          isLocked: dailyLog.isLocked,
          estimatedTotal,
          doneEstimated,
          doneCount,
          totalCount,
          todos: b.todos.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            estimatedMinutes: t.estimatedMinutes,
            actualMinutes: t.actualMinutes,
            sortOrder: t.sortOrder,
          })),
        };
      });

      const totalEstimatedMinutes = blocks.reduce((acc, b) => acc + b.estimatedTotal, 0);
      const completedEstimatedMinutes = blocks.reduce((acc, b) => acc + b.doneEstimated, 0);
      const completedCount = blocks.reduce((acc, b) => acc + b.doneCount, 0);
      const scorePreview = computeDailyScore({
        totalEstimatedMinutes,
        completedEstimatedMinutes,
        completedCount,
      });

      return {
        dailyLog: {
          id: dailyLog.id,
          date: dailyLog.date,
          status: dailyLog.status,
          isLocked: dailyLog.isLocked,
          score: dailyLog.score,
          scorePreview,
          summary: dailyLog.summary,
          aiSummary: dailyLog.aiSummary,
          sweptAt: dailyLog.sweptAt,
        },
        today,
        timeZone: user.timezone,
        blocks,
      };
    }),

  generateSummary: protectedProcedure
    .input(z.object({ date: dateKeySchema }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const day = await ctx.db.dailyLog.findUnique({
        where: { userId_date: { userId, date: input.date } },
        include: {
          hourBlocks: {
            orderBy: { hour: "asc" },
            select: { hour: true, plannedText: true, reflectionText: true },
          },
          todos: {
            select: {
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

      if (!day) throw new TRPCError({ code: "NOT_FOUND" });

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

      const summary = buildDeterministicSummary({
        date: day.date,
        plannedByHour: day.hourBlocks.map((b) => ({ hour: b.hour, text: b.plannedText })),
        reflectionByHour: day.hourBlocks.map((b) => ({ hour: b.hour, text: b.reflectionText })),
        todosByHour: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          todos: todosByHourMap.get(hour) ?? [],
        })),
        deferredCount: 0,
      });

      const rewrite = await rewriteSummaryWithGemini({
        date: day.date,
        deterministicSummary: summary,
      });

      await ctx.db.dailyLog.update({
        where: { id: day.id },
        data: {
          summary,
          aiSummary: rewrite.ok ? rewrite.text : day.aiSummary,
        },
      });

      return {
        summary,
        aiSummary: rewrite.ok ? rewrite.text : day.aiSummary,
        aiError: rewrite.ok ? null : rewrite.error,
      };
    }),
});


