import { PrismaClient, TodoStatus, DailyLogStatus } from "../generated/prisma";

const db = new PrismaClient();

function formatDateYYYYMMDD(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysUtc(date: Date, days: number) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

async function ensureDailyLogWithBlocks(opts: {
  userId: string;
  date: string;
  status: DailyLogStatus;
  isLocked?: boolean;
}) {
  return await db.dailyLog.upsert({
    where: { userId_date: { userId: opts.userId, date: opts.date } },
    create: {
      userId: opts.userId,
      date: opts.date,
      status: opts.status,
      isLocked: opts.isLocked ?? false,
      hourBlocks: {
        create: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          plannedText: "",
          reflectionText: "",
        })),
      },
    },
    update: {},
    include: { hourBlocks: true },
  });
}

async function main() {
  const now = new Date();
  const today = formatDateYYYYMMDD(now);
  const yesterday = formatDateYYYYMMDD(addDaysUtc(now, -1));
  const tomorrow = formatDateYYYYMMDD(addDaysUtc(now, 1));

  const alice = await db.user.upsert({
    where: { email: "alice@example.com" },
    create: {
      email: "alice@example.com",
      name: "Alice",
      timezone: "UTC",
    },
    update: { name: "Alice", timezone: "UTC" },
  });

  const bob = await db.user.upsert({
    where: { email: "bob@example.com" },
    create: {
      email: "bob@example.com",
      name: "Bob",
      timezone: "UTC",
    },
    update: { name: "Bob", timezone: "UTC" },
  });

  const aliceYesterday = await ensureDailyLogWithBlocks({
    userId: alice.id,
    date: yesterday,
    status: DailyLogStatus.HISTORY,
    isLocked: true,
  });

  const aliceToday = await ensureDailyLogWithBlocks({
    userId: alice.id,
    date: today,
    status: DailyLogStatus.EXECUTION,
    isLocked: false,
  });

  const aliceTomorrow = await ensureDailyLogWithBlocks({
    userId: alice.id,
    date: tomorrow,
    status: DailyLogStatus.PLANNING,
    isLocked: false,
  });

  const bobToday = await ensureDailyLogWithBlocks({
    userId: bob.id,
    date: today,
    status: DailyLogStatus.EXECUTION,
    isLocked: false,
  });

  const alice9 = aliceToday.hourBlocks.find((b) => b.hour === 9);
  const alice10 = aliceToday.hourBlocks.find((b) => b.hour === 10);
  const alice15 = aliceToday.hourBlocks.find((b) => b.hour === 15);
  if (!alice9 || !alice10 || !alice15) throw new Error("Missing hour blocks");

  await db.hourBlock.updateMany({
    where: { dailyLogId: aliceToday.id, hour: 9 },
    data: { plannedText: "Deep work: roadmap + design review." },
  });
  await db.hourBlock.updateMany({
    where: { dailyLogId: aliceToday.id, hour: 10 },
    data: { plannedText: "Implement core mutations + tests." },
  });
  await db.hourBlock.updateMany({
    where: { dailyLogId: aliceToday.id, hour: 15 },
    data: { plannedText: "Workout + decompress.", reflectionText: "" },
  });

  await db.todo.createMany({
    data: [
      {
        dailyLogId: aliceToday.id,
        hourBlockId: alice9.id,
        title: "Write plan for day page UX",
        estimatedMinutes: 25,
        actualMinutes: 20,
        status: TodoStatus.DONE,
        sortOrder: 0,
      },
      {
        dailyLogId: aliceToday.id,
        hourBlockId: alice9.id,
        title: "Audit locking semantics",
        estimatedMinutes: 15,
        status: TodoStatus.PENDING,
        sortOrder: 1,
      },
      {
        dailyLogId: aliceToday.id,
        hourBlockId: alice10.id,
        title: "Implement todo DnD ordering",
        estimatedMinutes: 45,
        status: TodoStatus.PENDING,
        sortOrder: 0,
      },
      {
        dailyLogId: aliceToday.id,
        hourBlockId: alice10.id,
        title: "Add optimistic updates",
        estimatedMinutes: 30,
        status: TodoStatus.PENDING,
        sortOrder: 1,
      },
    ],
    skipDuplicates: true,
  });

  const aliceYesterday18 = aliceYesterday.hourBlocks.find((b) => b.hour === 18);
  if (!aliceYesterday18) throw new Error("Missing hour block");
  await db.hourBlock.updateMany({
    where: { dailyLogId: aliceYesterday.id, hour: 18 },
    data: {
      plannedText: "Wrap up + reflection.",
      reflectionText: "Good focus blocks. Left one task for backlog.",
    },
  });
  await db.todo.createMany({
    data: [
      {
        dailyLogId: aliceYesterday.id,
        hourBlockId: aliceYesterday18.id,
        title: "Send weekly update email",
        estimatedMinutes: 10,
        actualMinutes: 12,
        status: TodoStatus.DONE,
        sortOrder: 0,
      },
      {
        dailyLogId: aliceYesterday.id,
        hourBlockId: aliceYesterday18.id,
        title: "Clean up backlog logic",
        estimatedMinutes: 20,
        status: TodoStatus.PENDING,
        sortOrder: 1,
      },
    ],
    skipDuplicates: true,
  });

  await db.backlogItem.createMany({
    data: [
      {
        userId: alice.id,
        title: "Refactor analytics query",
        estimatedMinutes: 35,
        sourceDate: yesterday,
        sourceHour: 18,
      },
      {
        userId: alice.id,
        title: "Book dentist appointment",
        estimatedMinutes: 10,
      },
    ],
    skipDuplicates: true,
  });

  await db.hourBlock.updateMany({
    where: { dailyLogId: bobToday.id, hour: 14 },
    data: { plannedText: "Client meeting + notes." },
  });
  const bob14 = bobToday.hourBlocks.find((b) => b.hour === 14);
  if (!bob14) throw new Error("Missing hour blocks");
  await db.todo.createMany({
    data: [
      {
        dailyLogId: bobToday.id,
        hourBlockId: bob14.id,
        title: "Prepare agenda",
        estimatedMinutes: 15,
        status: TodoStatus.DONE,
        actualMinutes: 12,
        sortOrder: 0,
      },
      {
        dailyLogId: bobToday.id,
        hourBlockId: bob14.id,
        title: "Send follow-ups",
        estimatedMinutes: 20,
        status: TodoStatus.PENDING,
        sortOrder: 1,
      },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });


