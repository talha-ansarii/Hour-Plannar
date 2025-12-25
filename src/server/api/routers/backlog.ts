import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { getTodayKeyInTimeZone } from "@/server/domain/dates";
import { ensureDailyLogWith24Blocks } from "@/server/domain/daily";
import { TodoStatus } from "../../../../generated/prisma";

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const backlogRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).max(10_000).optional(),
          pageSize: z.number().int().min(1).max(100).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const skip = (page - 1) * pageSize;

      const [totalCount, items] = await Promise.all([
        ctx.db.backlogItem.count({ where: { userId } }),
        ctx.db.backlogItem.findMany({
          where: { userId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip,
          take: pageSize,
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

      return {
        items: items.map((i) => ({
          id: i.id,
          title: i.title,
          estimatedMinutes: i.estimatedMinutes,
          actualMinutes: i.actualMinutes,
          sourceDate: i.sourceDate,
          sourceHour: i.sourceHour,
          createdAt: i.createdAt,
        })),
        page,
        pageSize,
        totalCount,
        totalPages,
      };
    }),

  restore: protectedProcedure
    .input(
      z.object({
        itemId: z.string().cuid(),
        targetDate: dateKeySchema,
        targetHour: z.number().int().min(0).max(23),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const today = getTodayKeyInTimeZone(user.timezone);

      if (input.targetDate < today) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot restore into past days." });
      }

      const item = await ctx.db.backlogItem.findUnique({
        where: { id: input.itemId },
      });
      if (item?.userId !== userId) throw new TRPCError({ code: "NOT_FOUND" });

      const res = await ctx.db.$transaction(async (tx) => {
        const dailyLog = await ensureDailyLogWith24Blocks(tx, {
          userId,
          date: input.targetDate,
          today,
        });

        const block = await tx.hourBlock.findUnique({
          where: {
            dailyLogId_hour: { dailyLogId: dailyLog.id, hour: input.targetHour },
          },
        });
        if (!block) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const last = await tx.todo.findFirst({
          where: { hourBlockId: block.id },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });
        const sortOrder = (last?.sortOrder ?? -1) + 1;

        const todo = await tx.todo.create({
          data: {
            dailyLogId: dailyLog.id,
            hourBlockId: block.id,
            title: item.title,
            estimatedMinutes: item.estimatedMinutes,
            actualMinutes: item.actualMinutes,
            status: TodoStatus.PENDING,
            sortOrder,
          },
          select: { id: true },
        });

        await tx.backlogItem.delete({ where: { id: item.id } });

        return { restoredTodoId: todo.id, dailyLogId: dailyLog.id, hourBlockId: block.id };
      });

      return res;
    }),
});


