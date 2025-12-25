import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { getTodayKeyInTimeZone } from "@/server/domain/dates";

export const blocksRouter = createTRPCRouter({
  updatePlan: protectedProcedure
    .input(
      z.object({
        blockId: z.string().cuid(),
        text: z.string().max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const block = await ctx.db.hourBlock.findUnique({
        where: { id: input.blockId },
        select: {
          id: true,
          dailyLog: { select: { id: true, userId: true, date: true, isLocked: true } },
        },
      });
      if (block?.dailyLog.userId !== userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const today = getTodayKeyInTimeZone(user.timezone);
      if (block.dailyLog.date < today) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Past days are read-only." });
      }
      if (block.dailyLog.isLocked) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This day is locked." });
      }

      await ctx.db.hourBlock.update({
        where: { id: block.id },
        data: { plannedText: input.text },
      });
      return { ok: true };
    }),

  updateReflection: protectedProcedure
    .input(
      z.object({
        blockId: z.string().cuid(),
        text: z.string().max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const block = await ctx.db.hourBlock.findUnique({
        where: { id: input.blockId },
        select: {
          id: true,
          dailyLog: { select: { userId: true, date: true } },
        },
      });
      if (block?.dailyLog.userId !== userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const today = getTodayKeyInTimeZone(user.timezone);

      if (block.dailyLog.date !== today) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Reflections can only be edited for today.",
        });
      }

      await ctx.db.hourBlock.update({
        where: { id: block.id },
        data: { reflectionText: input.text },
      });
      return { ok: true };
    }),
});


