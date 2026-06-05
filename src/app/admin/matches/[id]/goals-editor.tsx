"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { addMatchGoal, deleteMatchGoal } from "@/lib/admin/actions";

type Team = { id: number; name: string; fifa_code: string };

export type RosterPlayer = {
  id: number;
  name: string;
  jersey_number: number | null;
  position: "GK" | "DEF" | "MID" | "FWD" | null;
  team_id: number;
};

export type GoalRow = {
  id: number;
  minute: number | null;
  is_penalty: boolean;
  is_own_goal: boolean;
  player_id: number;
  player_name: string;
  jersey_number: number | null;
  team_id: number;
};

type Props = {
  matchId: number;
  homeTeam: Team;
  awayTeam: Team;
  goals: GoalRow[];
  roster: RosterPlayer[];
};

type PlayerOption = ComboboxOption & { player: RosterPlayer };

export function GoalsEditor({
  matchId,
  homeTeam,
  awayTeam,
  goals,
  roster,
}: Props) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [minute, setMinute] = useState<string>("");
  const [isPenalty, setIsPenalty] = useState(false);
  const [isOwnGoal, setIsOwnGoal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const teamCodeById = useMemo(() => {
    const m = new Map<number, string>();
    m.set(homeTeam.id, homeTeam.fifa_code);
    m.set(awayTeam.id, awayTeam.fifa_code);
    return m;
  }, [homeTeam, awayTeam]);

  const playerOptions: PlayerOption[] = useMemo(
    () =>
      roster.map((p) => ({
        value: String(p.id),
        label: p.name,
        searchText: `${teamCodeById.get(p.team_id) ?? ""} ${p.position ?? ""}`,
        player: p,
      })),
    [roster, teamCodeById],
  );

  const handleAdd = () => {
    setError(null);
    if (!playerId) {
      setError("Elegí un jugador");
      return;
    }
    const minuteValue = minute === "" ? null : Number(minute);
    if (minute !== "" && !Number.isInteger(minuteValue)) {
      setError("Minuto inválido");
      return;
    }
    startTransition(async () => {
      const result = await addMatchGoal({
        matchId,
        playerId: Number(playerId),
        minute: minuteValue,
        isPenalty,
        isOwnGoal,
      });
      if (result.ok) {
        setPlayerId(null);
        setMinute("");
        setIsPenalty(false);
        setIsOwnGoal(false);
      } else {
        setError(result.error);
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("¿Borrar este gol?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteMatchGoal(id);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Goleadores</h2>
        <span className="text-xs text-muted-foreground">
          {goals.length} {goals.length === 1 ? "gol" : "goles"} cargado
          {goals.length === 1 ? "" : "s"}
        </span>
      </div>

      {goals.length > 0 ? (
        <ul className="mb-4 space-y-1.5">
          {goals.map((g) => (
            <li
              key={g.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <span className="w-12 font-mono text-xs text-muted-foreground tabular-nums">
                {g.minute != null ? `${g.minute}'` : "—"}
              </span>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {teamCodeById.get(g.team_id) ?? "?"}
              </span>
              <span className="flex-1 truncate">
                {g.player_name}
                {g.jersey_number != null ? (
                  <span className="ml-1 text-xs text-muted-foreground">
                    #{g.jersey_number}
                  </span>
                ) : null}
              </span>
              {g.is_penalty ? (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  penal
                </span>
              ) : null}
              {g.is_own_goal ? (
                <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                  EC
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => handleDelete(g.id)}
                disabled={isPending}
                aria-label="Borrar gol"
                className="ml-1 rounded-md p-1 text-muted-foreground transition active:scale-[0.96] hover:bg-muted hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-xs text-muted-foreground">
          Sin goles cargados. Agregalos abajo o esperá al sync de api-football.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <div className="min-w-[200px] flex-1">
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Jugador
          </label>
          <Combobox
            options={playerOptions}
            value={playerId}
            onChange={(v) => setPlayerId(v)}
            placeholder="Elegir jugador..."
            searchPlaceholder="Buscar apellido..."
            disabled={isPending}
            renderOption={(opt) => <PlayerRow option={opt} teamCodeById={teamCodeById} />}
            renderValue={(opt) => <PlayerRow option={opt} teamCodeById={teamCodeById} compact />}
          />
        </div>
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Minuto
          </label>
          <input
            type="number"
            min={1}
            max={130}
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
            disabled={isPending}
            placeholder="—"
            className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-center font-mono text-sm tabular-nums"
          />
        </div>
        <label className="flex h-9 items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={isPenalty}
            onChange={(e) => setIsPenalty(e.target.checked)}
            disabled={isPending}
            className="accent-primary"
          />
          penal
        </label>
        <label className="flex h-9 items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={isOwnGoal}
            onChange={(e) => setIsOwnGoal(e.target.checked)}
            disabled={isPending}
            className="accent-primary"
          />
          en contra
        </label>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !playerId}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition active:scale-[0.97] hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar gol
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function PlayerRow({
  option,
  teamCodeById,
  compact,
}: {
  option: PlayerOption;
  teamCodeById: Map<number, string>;
  compact?: boolean;
}) {
  const p = option.player;
  const teamCode = teamCodeById.get(p.team_id) ?? "?";
  return (
    <div className={`flex w-full items-center gap-2 ${compact ? "" : ""}`}>
      {p.position ? (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {p.position}
        </span>
      ) : null}
      <span className="flex-1 truncate text-sm">{p.name}</span>
      <span className="font-mono text-[10px] text-muted-foreground">
        {p.jersey_number != null ? `#${p.jersey_number}` : ""}
      </span>
      <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {teamCode}
      </span>
    </div>
  );
}
