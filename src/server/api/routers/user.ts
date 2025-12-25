import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

const timeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  // Basic IANA-like validation; final validation happens client-side via resolvedOptions().
  .regex(/^[A-Za-z_]+\/[A-Za-z0-9_\-+]+$/);

export const userRouter = createTRPCRouter({
  setTimezone: protectedProcedure
    .input(z.object({ timeZone: timeZoneSchema }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { timezone: input.timeZone },
      });
      return { ok: true };
    }),
});


