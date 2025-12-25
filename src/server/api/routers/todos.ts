import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { getTodayKeyInTimeZone } from "@/server/domain/dates";
import { TodoStatus, type Prisma } from "../../../../generated/prisma";

function normalizeSortOrders(
  todos: Array<{ id: string; sortOrder: number }>,
): Array<{ id: string; sortOrder: number }> {
  return todos
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t, idx) => ({ id: t.id, sortOrder: idx }));
}

async function resequenceBlockTodos(
  tx: Prisma.TransactionClient,
  hourBlockId: string,
) {
  const todos = await tx.todo.findMany({
    where: { hourBlockId },
    select: { id: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const normalized = normalizeSortOrders(todos);
  await Promise.all(
    normalized.map((t) =>
      tx.todo.update({ where: { id: t.id }, data: { sortOrder: t.sortOrder } }),
    ),
  );
}

export const todosRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        blockId: z.string().cuid(),
        title: z.string().trim().min(1).max(200),
        estimateMinutes: z.number().int().min(0).max(24 * 60),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const block = await ctx.db.hourBlock.findUnique({
        where: { id: input.blockId },
        select: {
          id: true,
          dailyLogId: true,
          dailyLog: { select: { userId: true, date: true, isLocked: true } },
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

      const last = await ctx.db.todo.findFirst({
        where: { hourBlockId: block.id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      const sortOrder = (last?.sortOrder ?? -1) + 1;

      const todo = await ctx.db.todo.create({
        data: {
          dailyLogId: block.dailyLogId,
          hourBlockId: block.id,
          title: input.title,
          estimatedMinutes: input.estimateMinutes,
          status: TodoStatus.PENDING,
          sortOrder,
        },
        select: {
          id: true,
          title: true,
          status: true,
          estimatedMinutes: true,
          actualMinutes: true,
          sortOrder: true,
          hourBlockId: true,
        },
      });

      return todo;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        todoId: z.string().cuid(),
        status: z.nativeEnum(TodoStatus),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const todo = await ctx.db.todo.findUnique({
        where: { id: input.todoId },
        select: {
          id: true,
          dailyLog: { select: { userId: true, date: true } },
        },
      });
      if (todo?.dailyLog.userId !== userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const today = getTodayKeyInTimeZone(user.timezone);

      if (todo.dailyLog.date !== today) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only today's todos can be marked complete/incomplete.",
        });
      }

      await ctx.db.todo.update({
        where: { id: todo.id },
        data: { status: input.status },
      });
      return { ok: true };
    }),

  updateBlockStatus: protectedProcedure
    .input(
      z.object({
        blockId: z.string().cuid(),
        status: z.nativeEnum(TodoStatus),
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
      if (block?.dailyLog.userId !== userId) throw new TRPCError({ code: "NOT_FOUND" });

      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const today = getTodayKeyInTimeZone(user.timezone);

      // Bulk completion is an execution action: only allowed for today.
      if (block.dailyLog.date !== today) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only today's todos can be bulk-updated.",
        });
      }

      await ctx.db.todo.updateMany({
        where: { hourBlockId: block.id },
        data: { status: input.status },
      });

      return { ok: true };
    }),

  updateEstimate: protectedProcedure
    .input(
      z.object({
        todoId: z.string().cuid(),
        minutes: z.number().int().min(0).max(24 * 60),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const todo = await ctx.db.todo.findUnique({
        where: { id: input.todoId },
        select: {
          id: true,
          dailyLog: { select: { userId: true, date: true, isLocked: true } },
        },
      });
      if (todo?.dailyLog.userId !== userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const today = getTodayKeyInTimeZone(user.timezone);

      if (todo.dailyLog.date < today) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Past days are read-only." });
      }
      if (todo.dailyLog.isLocked) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This day is locked." });
      }

      await ctx.db.todo.update({
        where: { id: todo.id },
        data: { estimatedMinutes: input.minutes },
      });
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ todoId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const todo = await ctx.db.todo.findUnique({
        where: { id: input.todoId },
        select: {
          id: true,
          hourBlockId: true,
          dailyLog: { select: { userId: true, date: true, isLocked: true } },
        },
      });
      if (todo?.dailyLog.userId !== userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const today = getTodayKeyInTimeZone(user.timezone);

      if (todo.dailyLog.date < today) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Past days are read-only." });
      }
      if (todo.dailyLog.isLocked) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This day is locked." });
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.todo.delete({ where: { id: todo.id } });
        await resequenceBlockTodos(tx, todo.hourBlockId);
      });

      return { ok: true };
    }),

  move: protectedProcedure
    .input(
      z.object({
        todoId: z.string().cuid(),
        targetBlockId: z.string().cuid(),
        targetIndex: z.number().int().min(0).max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const todo = await ctx.db.todo.findUnique({
        where: { id: input.todoId },
        select: {
          id: true,
          hourBlockId: true,
          dailyLogId: true,
          dailyLog: { select: { userId: true, date: true, isLocked: true } },
        },
      });
      if (todo?.dailyLog.userId !== userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const targetBlock = await ctx.db.hourBlock.findUnique({
        where: { id: input.targetBlockId },
        select: { id: true, dailyLogId: true },
      });
      if (!targetBlock) throw new TRPCError({ code: "NOT_FOUND" });
      if (targetBlock.dailyLogId !== todo.dailyLogId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Todos can only be moved within the same day.",
        });
      }

      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const today = getTodayKeyInTimeZone(user.timezone);

      if (todo.dailyLog.date < today) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Past days are read-only." });
      }
      if (todo.dailyLog.isLocked) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This day is locked." });
      }

      await ctx.db.$transaction(async (tx) => {
        const sourceBlockId = todo.hourBlockId;
        const targetBlockId = targetBlock.id;

        // Update block first.
        await tx.todo.update({
          where: { id: todo.id },
          data: { hourBlockId: targetBlockId },
        });

        // Normalize source and target lists (and apply targetIndex insertion if provided).
        const targetTodos = await tx.todo.findMany({
          where: { hourBlockId: targetBlockId },
          select: { id: true, sortOrder: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });

        const withoutGaps = normalizeSortOrders(targetTodos);
        const idx = input.targetIndex ?? withoutGaps.length - 1;

        const clampedIndex = Math.max(0, Math.min(withoutGaps.length - 1, idx));
        const movedExists = withoutGaps.some((t) => t.id === todo.id);
        if (!movedExists) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const removed = withoutGaps.filter((t) => t.id !== todo.id);
        removed.splice(clampedIndex, 0, { id: todo.id, sortOrder: 0 });
        const resequencedTarget = removed.map((t, i) => ({ id: t.id, sortOrder: i }));

        await Promise.all(
          resequencedTarget.map((t) =>
            tx.todo.update({ where: { id: t.id }, data: { sortOrder: t.sortOrder } }),
          ),
        );

        if (sourceBlockId !== targetBlockId) {
          await resequenceBlockTodos(tx, sourceBlockId);
        }
      });

      return { ok: true };
    }),
});


