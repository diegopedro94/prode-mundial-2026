import { z } from "zod";

const score = z.coerce
  .number()
  .int("Solo enteros")
  .min(0, "Mínimo 0")
  .max(20, "Máximo 20");

export const matchResultSchema = z
  .object({
    matchId: z.coerce.number().int().positive(),
    homeScore: score.nullable(),
    awayScore: score.nullable(),
    wentToPenalties: z.boolean().default(false),
    pkWinnerTeamId: z.coerce.number().int().positive().nullable(),
    status: z.enum(["scheduled", "live", "finished"]),
    // Knockout matches require a winner. Set for group-stage too (null when tied).
    stage: z.enum(["group", "r32", "r16", "qf", "sf", "third_place", "final"]),
  })
  .refine(
    (v) => {
      if (v.status !== "finished") return true;
      return v.homeScore !== null && v.awayScore !== null;
    },
    { message: "Para 'finished' hay que cargar ambos scores", path: ["status"] },
  )
  .refine(
    (v) => {
      if (v.status !== "finished") return true;
      if (v.stage === "group") return true;
      // Knockout matches that end tied must go to penalties with a winner.
      if (v.homeScore === v.awayScore) {
        return v.wentToPenalties && v.pkWinnerTeamId !== null;
      }
      return true;
    },
    {
      message:
        "Partido de eliminatorias empatado: marcá 'fue a penales' y el ganador del shootout",
      path: ["wentToPenalties"],
    },
  );

export type MatchResultInput = z.infer<typeof matchResultSchema>;

export const roundLockSchema = z.object({
  stage: z.enum(["group", "r32", "r16", "qf", "sf", "third_place", "final"]),
  locksAt: z.string().datetime({ offset: true }),
});

export type RoundLockInput = z.infer<typeof roundLockSchema>;

export const allowedEmailSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  isAdmin: z.boolean().default(false),
});

export type AllowedEmailInput = z.infer<typeof allowedEmailSchema>;

export const goalSchema = z.object({
  matchId: z.coerce.number().int().positive(),
  playerId: z.coerce.number().int().positive(),
  minute: z.coerce.number().int().min(1).max(130).nullable(),
  isPenalty: z.boolean().default(false),
  isOwnGoal: z.boolean().default(false),
});

export type GoalInput = z.infer<typeof goalSchema>;

export const setUserAdminSchema = z.object({
  userId: z.string().uuid(),
  isAdmin: z.boolean(),
});

export type SetUserAdminInput = z.infer<typeof setUserAdminSchema>;

export const setUserDisplayNameSchema = z.object({
  userId: z.string().uuid(),
  displayName: z
    .string()
    .trim()
    .min(1, "El nombre no puede estar vacío")
    .max(40, "Máximo 40 caracteres"),
});

export type SetUserDisplayNameInput = z.infer<typeof setUserDisplayNameSchema>;
