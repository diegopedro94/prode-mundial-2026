import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Shield, Trophy } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { teamName } from "@/lib/teams/i18n";

import { AdminToggle } from "./admin-toggle";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_admin: boolean;
};

type SpecialRow = {
  champion_team_id: number | null;
  runner_up_team_id: number | null;
  top_scorer_player_id: number | null;
  mvp_player_id: number | null;
  best_gk_player_id: number | null;
};

type PredictionRow = {
  match_id: number;
  home_score: number;
  away_score: number;
  pk_winner_team_id: number | null;
  points: number | null;
  match: {
    id: number;
    stage: "group" | "r32" | "r16" | "qf" | "sf" | "third_place" | "final";
    group_letter: string | null;
    scheduled_at: string;
    status: "scheduled" | "live" | "finished";
    home_score: number | null;
    away_score: number | null;
    home_team: { id: number; fifa_code: string; flag_url: string | null } | null;
    away_team: { id: number; fifa_code: string; flag_url: string | null } | null;
  } | null;
};

const TZ = "America/Argentina/Buenos_Aires";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, is_admin")
    .eq("id", id)
    .maybeSingle<ProfileRow>();
  if (!profileData) notFound();

  const {
    data: { user: meUser },
  } = await supabase.auth.getUser();
  const isSelf = meUser?.id === profileData.id;

  const [{ data: predsData }, { data: specialData }] = await Promise.all([
    supabase
      .from("predictions")
      .select(
        `match_id, home_score, away_score, pk_winner_team_id, points,
         match:matches!match_id(id, stage, group_letter, scheduled_at, status,
           home_score, away_score,
           home_team:home_team_id(id, fifa_code, flag_url),
           away_team:away_team_id(id, fifa_code, flag_url))`,
      )
      .eq("user_id", id),
    supabase
      .from("special_predictions")
      .select(
        "champion_team_id, runner_up_team_id, top_scorer_player_id, mvp_player_id, best_gk_player_id",
      )
      .eq("user_id", id)
      .maybeSingle<SpecialRow>(),
  ]);

  const predictions = ((predsData ?? []) as unknown as PredictionRow[])
    .filter((p): p is PredictionRow & { match: NonNullable<PredictionRow["match"]> } => p.match != null)
    .sort(
      (a, b) =>
        new Date(a.match.scheduled_at).getTime() -
        new Date(b.match.scheduled_at).getTime(),
    );

  // Group by group letter (group stage) / stage (knockouts)
  const groups = new Map<string, typeof predictions>();
  for (const p of predictions) {
    const key = p.match.stage === "group" ? `Grupo ${p.match.group_letter}` : stageLabel(p.match.stage);
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  // Pull team + player names for the specials display
  const teamIds = [specialData?.champion_team_id, specialData?.runner_up_team_id].filter(
    (x): x is number => x != null,
  );
  const playerIds = [
    specialData?.top_scorer_player_id,
    specialData?.mvp_player_id,
    specialData?.best_gk_player_id,
  ].filter((x): x is number => x != null);

  const [{ data: teamRows }, { data: playerRows }] = await Promise.all([
    teamIds.length
      ? supabase.from("teams").select("id, name, fifa_code, flag_url").in("id", teamIds)
      : Promise.resolve({ data: [] as Array<{ id: number; name: string; fifa_code: string; flag_url: string | null }> }),
    playerIds.length
      ? supabase
          .from("players")
          .select(
            `id, name, jersey_number, position,
             team:teams!team_id(fifa_code, flag_url)`,
          )
          .in("id", playerIds)
      : Promise.resolve({ data: [] as Array<{ id: number; name: string; jersey_number: number | null; position: string | null; team: { fifa_code: string; flag_url: string | null } | null }> }),
  ]);

  const teamsById = new Map((teamRows ?? []).map((t) => [t.id, t]));
  const playersById = new Map((playerRows ?? []).map((p) => [p.id, p]));

  const totalPoints = predictions.reduce((acc, p) => acc + (p.points ?? 0), 0);
  const finishedCount = predictions.filter((p) => p.match.status === "finished").length;
  const exactCount = predictions.filter(
    (p) =>
      p.match.status === "finished" &&
      p.match.home_score === p.home_score &&
      p.match.away_score === p.away_score,
  ).length;

  return (
    <section className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Volver a jugadores
      </Link>

      <header className="flex flex-wrap items-start gap-4">
        <Avatar name={profileData.display_name} avatarUrl={profileData.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {profileData.display_name}
            </h1>
            {profileData.is_admin ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <Shield className="h-3 w-3" />
                Admin
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {predictions.length} predicciones cargadas · {totalPoints} pts ·{" "}
            {exactCount} exactos / {finishedCount} jugados
          </p>
        </div>
        <AdminToggle
          userId={profileData.id}
          isAdmin={profileData.is_admin}
          isSelf={isSelf}
          displayName={profileData.display_name}
        />
      </header>

      {specialData ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Predicciones especiales</h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <SpecialRow
              label="Campeón"
              icon="🏆"
              value={specialData.champion_team_id ? teamLabel(teamsById.get(specialData.champion_team_id)) : null}
            />
            <SpecialRow
              label="Subcampeón"
              icon="🥈"
              value={specialData.runner_up_team_id ? teamLabel(teamsById.get(specialData.runner_up_team_id)) : null}
            />
            <SpecialRow
              label="Goleador"
              icon="⚽"
              value={specialData.top_scorer_player_id ? playerLabel(playersById.get(specialData.top_scorer_player_id)) : null}
            />
            <SpecialRow
              label="MVP"
              icon="⭐"
              value={specialData.mvp_player_id ? playerLabel(playersById.get(specialData.mvp_player_id)) : null}
            />
            <SpecialRow
              label="Mejor arquero"
              icon="🧤"
              value={specialData.best_gk_player_id ? playerLabel(playersById.get(specialData.best_gk_player_id)) : null}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          (Sin predicciones especiales cargadas)
        </p>
      )}

      {[...groups.entries()].map(([groupTitle, list]) => (
        <div key={groupTitle} className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {groupTitle}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Cuándo</th>
                  <th className="px-3 py-2">Partido</th>
                  <th className="px-3 py-2 text-center">Pronóstico</th>
                  <th className="px-3 py-2 text-center">Real</th>
                  <th className="px-3 py-2 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.match_id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {new Date(p.match.scheduled_at).toLocaleDateString("es-AR", {
                        timeZone: TZ,
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <MatchPair home={p.match.home_team} away={p.match.away_team} />
                    </td>
                    <td className="px-3 py-2 text-center font-mono tabular-nums">
                      {p.home_score}-{p.away_score}
                    </td>
                    <td className="px-3 py-2 text-center font-mono tabular-nums text-muted-foreground">
                      {p.match.status === "finished"
                        ? `${p.match.home_score}-${p.match.away_score}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {p.match.status === "finished" ? p.points ?? 0 : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {predictions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-10 text-center">
          <Trophy className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            Este jugador aún no cargó predicciones.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function stageLabel(stage: string): string {
  return {
    group: "Grupos",
    r32: "Ronda de 32",
    r16: "Octavos",
    qf: "Cuartos",
    sf: "Semifinales",
    third_place: "Tercer puesto",
    final: "Final",
  }[stage] ?? stage;
}

function teamLabel(team: { name: string; fifa_code: string } | undefined): string | null {
  if (!team) return null;
  return `${teamName(team.fifa_code, team.name)} (${team.fifa_code})`;
}

function playerLabel(p: { name: string; jersey_number: number | null; team: { fifa_code: string } | null } | undefined): string | null {
  if (!p) return null;
  const num = p.jersey_number != null ? ` #${p.jersey_number}` : "";
  const team = p.team?.fifa_code ? ` (${p.team.fifa_code})` : "";
  return `${p.name}${num}${team}`;
}

function SpecialRow({ label, icon, value }: { label: string; icon: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span>{icon}</span>
        {label}
      </div>
      <span className={`text-sm ${value ? "font-medium" : "text-muted-foreground"}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function MatchPair({
  home,
  away,
}: {
  home: { fifa_code: string; flag_url: string | null } | null;
  away: { fifa_code: string; flag_url: string | null } | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Flag flag={home?.flag_url ?? null} />
      <span className="font-medium">{home?.fifa_code ?? "—"}</span>
      <span className="text-muted-foreground">vs</span>
      <span className="font-medium">{away?.fifa_code ?? "—"}</span>
      <Flag flag={away?.flag_url ?? null} />
    </span>
  );
}

function Flag({ flag }: { flag: string | null }) {
  if (!flag)
    return <span className="inline-block h-3 w-4 rounded-sm bg-muted" aria-hidden="true" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={flag} alt="" className="h-3 w-4 rounded-sm object-cover" loading="lazy" />
  );
}

function Avatar({
  name,
  avatarUrl,
  size = "sm",
}: {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "lg";
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const cls = size === "lg" ? "h-12 w-12 text-base" : "h-7 w-7 text-xs";
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={`${cls} shrink-0 rounded-full object-cover ring-1 ring-border`}
        loading="lazy"
      />
    );
  }
  return (
    <div className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground`}>
      {initials || "—"}
    </div>
  );
}
