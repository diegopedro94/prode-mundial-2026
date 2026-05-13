import { z } from "zod";

const score = z.coerce
  .number()
  .int("Solo números enteros")
  .min(0, "Mínimo 0")
  .max(20, "Máximo 20");

export const predictionSchema = z.object({
  matchId: z.coerce.number().int().positive(),
  homeScore: score,
  awayScore: score,
  pkWinnerTeamId: z.coerce.number().int().positive().nullable().optional(),
});

export type PredictionInput = z.infer<typeof predictionSchema>;

export const specialSchema = z.object({
  championTeamId: z.coerce.number().int().positive().nullable().optional(),
  runnerUpTeamId: z.coerce.number().int().positive().nullable().optional(),
  topScorerPlayerId: z.coerce.number().int().positive().nullable().optional(),
  mvpPlayerId: z.coerce.number().int().positive().nullable().optional(),
  bestGkPlayerId: z.coerce.number().int().positive().nullable().optional(),
});

export type SpecialInput = z.infer<typeof specialSchema>;
