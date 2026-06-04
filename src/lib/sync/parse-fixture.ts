import type { Database, TablesUpdate } from "@/lib/database.types";

type MatchStatus = Database["public"]["Enums"]["match_status"];

export const STATUS_MAP: Record<string, MatchStatus> = {
  TBD: "scheduled",
  NS: "scheduled",
  SCH: "scheduled",
  PST: "scheduled",
  "1H": "live",
  HT: "live",
  "2H": "live",
  ET: "live",
  BT: "live",
  P: "live",
  SUSP: "live",
  INT: "live",
  LIVE: "live",
  FT: "finished",
  AET: "finished",
  PEN: "finished",
  AWD: "finished",
  WO: "finished",
};

export type ApiFixturePayload = {
  fixture: {
    id: number;
    status: { short: string };
  };
  teams: {
    home: { id: number; winner: boolean | null };
    away: { id: number; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score: {
    fulltime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
};

export type ParseResult =
  | { kind: "update"; update: TablesUpdate<"matches"> }
  | { kind: "skip"; reason: string };

/**
 * Map an api-football fixture into a `matches` UPDATE payload, or return a
 * skip reason. Covers the api-football quirks we hit in practice:
 *
 *  - Unknown status code → don't downgrade to 'scheduled' (could revert a
 *    finished match if the API momentarily returns garbage).
 *  - Finished match with both score fields null → don't overwrite the DB
 *    with nulls; the next poll will retry.
 *  - PEN status but penalty.home/away missing → leave pk_winner null
 *    instead of forcing 0-0 and a wrong winner.
 *  - Teams.winner is preferred when set, falls back to score comparison.
 */
export function parseApiFixture(
  fixture: ApiFixturePayload,
  internalHomeTeamId: number,
  internalAwayTeamId: number,
): ParseResult {
  const apiStatus = fixture.fixture.status.short;
  const mapped = STATUS_MAP[apiStatus];
  if (!mapped) {
    return { kind: "skip", reason: `unknown api-football status "${apiStatus}"` };
  }

  const wentToPenalties = apiStatus === "PEN";

  // Score: prefer fulltime if available, else fall back to live goals.
  let homeScore: number | null = fixture.goals.home;
  let awayScore: number | null = fixture.goals.away;
  if (fixture.score.fulltime.home != null) homeScore = fixture.score.fulltime.home;
  if (fixture.score.fulltime.away != null) awayScore = fixture.score.fulltime.away;

  // For finished matches, both scores have to be present. If api-football is
  // serving incomplete data (rare but observed mid-edit), skip; we'll catch
  // it next poll.
  if (mapped === "finished" && (homeScore == null || awayScore == null)) {
    return {
      kind: "skip",
      reason: `finished match missing scores (goals=${fixture.goals.home}/${fixture.goals.away}, fulltime=${fixture.score.fulltime.home}/${fixture.score.fulltime.away})`,
    };
  }

  let winnerTeamId: number | null = null;
  if (mapped === "finished") {
    if (fixture.teams.home.winner === true) winnerTeamId = internalHomeTeamId;
    else if (fixture.teams.away.winner === true) winnerTeamId = internalAwayTeamId;
    else if (homeScore != null && awayScore != null) {
      if (homeScore > awayScore) winnerTeamId = internalHomeTeamId;
      else if (awayScore > homeScore) winnerTeamId = internalAwayTeamId;
      // else stays null (group-stage draw)
    }
  }

  let pkWinnerTeamId: number | null = null;
  if (wentToPenalties) {
    const ph = fixture.score.penalty.home;
    const pa = fixture.score.penalty.away;
    if (ph != null && pa != null && ph !== pa) {
      pkWinnerTeamId = ph > pa ? internalHomeTeamId : internalAwayTeamId;
    }
    // If penalties happened but the API hasn't published the shootout score
    // yet, leave pk_winner null. Better an empty bonus than a wrong one.
  }

  return {
    kind: "update",
    update: {
      status: mapped,
      home_score: homeScore,
      away_score: awayScore,
      went_to_penalties: wentToPenalties,
      pk_winner_team_id: pkWinnerTeamId,
      winner_team_id: winnerTeamId,
    },
  };
}

/**
 * Returns true when the api-football envelope carries a non-empty `errors`
 * object/array. Their endpoints return 200 OK + a `response: []` body when
 * the request was rejected by plan limits or rate-limit, so we have to
 * sniff the envelope.
 */
export function hasApiErrors(body: { errors?: unknown }): boolean {
  const errs = body.errors;
  if (errs == null) return false;
  if (Array.isArray(errs)) return errs.length > 0;
  if (typeof errs === "object") return Object.keys(errs as object).length > 0;
  return false;
}
