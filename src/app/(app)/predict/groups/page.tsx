import { createSupabaseServerClient } from "@/lib/supabase/server";

import { GroupsBoard } from "./groups-board";

type MatchRow = {
  id: number;
  group_letter: string | null;
  scheduled_at: string;
  home_team: { id: number; name: string; fifa_code: string; flag_url: string | null } | null;
  away_team: { id: number; name: string; fifa_code: string; flag_url: string | null } | null;
};

type PredictionRow = {
  match_id: number;
  home_score: number;
  away_score: number;
};

type RoundRow = { locks_at: string };

export default async function PredictGroupsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Layout guard already redirects unauthenticated users.
  const userId = user!.id;

  const [matchesRes, predictionsRes, roundRes] = await Promise.all([
    supabase
      .from("matches")
      .select(
        `id, group_letter, scheduled_at,
         home_team:home_team_id(id, name, fifa_code, flag_url),
         away_team:away_team_id(id, name, fifa_code, flag_url)`,
      )
      .eq("stage", "group")
      .order("scheduled_at"),
    supabase
      .from("predictions")
      .select("match_id, home_score, away_score")
      .eq("user_id", userId),
    supabase
      .from("rounds")
      .select("locks_at")
      .eq("stage", "group")
      .maybeSingle<RoundRow>(),
  ]);

  const matches = (matchesRes.data ?? []) as unknown as MatchRow[];
  const predictions = (predictionsRes.data ?? []) as PredictionRow[];
  const lockAt = roundRes.data?.locks_at ?? null;
  const isLocked = lockAt ? new Date(lockAt) <= new Date() : false;

  const predictionByMatch = new Map(predictions.map((p) => [p.match_id, p]));

  const groups = new Map<string, MatchRow[]>();
  for (const m of matches) {
    if (!m.group_letter || !m.home_team || !m.away_team) continue;
    const arr = groups.get(m.group_letter) ?? [];
    arr.push(m);
    groups.set(m.group_letter, arr);
  }
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  if (sortedGroups.length === 0) {
    return (
      <section className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Fase de grupos</h1>
        </header>
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Todav&iacute;a no hay partidos cargados. El admin tiene que correr
          {" "}
          <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">
            npm run seed:teams &amp;&amp; npm run seed:fixtures
          </code>
          .
        </div>
      </section>
    );
  }

  return (
    <GroupsBoard
      groups={sortedGroups.map(([letter, matches]) => ({
        letter,
        matches: matches.map((m) => ({
          id: m.id,
          scheduledAt: m.scheduled_at,
          homeTeam: m.home_team!,
          awayTeam: m.away_team!,
          prediction: predictionByMatch.get(m.id) ?? null,
        })),
      }))}
      isLocked={isLocked}
      lockAt={lockAt}
    />
  );
}
