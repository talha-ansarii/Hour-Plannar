import {
  DailyLogStatus,
  type Prisma,
  type PrismaClient,
} from "../../../generated/prisma";

import {
  type DateKey,
  compareDateKeys,
  assertDateKey,
} from "@/server/domain/dates";

export function resolveDailyStatus(date: DateKey, today: DateKey) {
  const cmp = compareDateKeys(date, today);
  if (cmp < 0) return DailyLogStatus.HISTORY;
  if (cmp === 0) return DailyLogStatus.EXECUTION;
  return DailyLogStatus.PLANNING;
}

export async function ensureDailyLogWith24Blocks(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: { userId: string; date: string; today: string },
) {
  assertDateKey(input.date);
  assertDateKey(input.today);
  const status = resolveDailyStatus(input.date, input.today);

  const dailyLog = await prisma.dailyLog.upsert({
    where: { userId_date: { userId: input.userId, date: input.date } },
    create: {
      userId: input.userId,
      date: input.date,
      status,
      isLocked: false,
      hourBlocks: {
        create: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          plannedText: "",
          reflectionText: "",
        })),
      },
    },
    update: {
      status,
    },
  });

  const blocks = await prisma.hourBlock.findMany({
    where: { dailyLogId: dailyLog.id },
    select: { id: true, hour: true },
  });

  const existing = new Set(blocks.map((b) => b.hour));
  const missingHours = Array.from({ length: 24 }, (_, h) => h).filter(
    (h) => !existing.has(h),
  );

  if (missingHours.length > 0) {
    await prisma.hourBlock.createMany({
      data: missingHours.map((hour) => ({
        dailyLogId: dailyLog.id,
        hour,
        plannedText: "",
        reflectionText: "",
      })),
      skipDuplicates: true,
    });
  }

  return dailyLog;
}


