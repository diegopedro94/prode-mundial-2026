"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Trophy, Medal, Target, Star, Shield } from "lucide-react";

import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { upsertSpecial } from "@/lib/predictions/actions";
import { teamName } from "@/lib/teams/i18n";

type Team = {
  id: number;
  name: string;
  fifa_code: string;
  flag_url: string | null;
};

type Player = {
  id: number;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD" | null;
  jersey_number: number | null;
  team: { fifa_code: string; flag_url: string | null } | null;
};

type Special = {
  champion_team_id: number | null;
  runner_up_team_id: number | null;
  top_scorer_player_id: number | null;
  mvp_player_id: number | null;
  best_gk_player_id: number | null;
};

type Props = {
  teams: Team[];
  players: Player[];
  initial: Special | null;
  isLocked: boolean;
  lockAt: string | null;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 800;

const EMPTY: Special = {
  champion_team_id: null,
  runner_up_team_id: null,
  top_scorer_player_id: null,
  mvp_player_id: null,
  best_gk_player_id: null,
};

const POS_TINT: Record<
  "GK" | "DEF" | "MID" | "FWD",
  { label: string; cls: string }
> = {
  GK: { label: "GK", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200" },
  DEF: { label: "DEF", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200" },
  MID: { label: "MID", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200" },
  FWD: { label: "FWD", cls: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200" },
};

function toIdString(value: number | null): string | null {
  return value == null ? null : String(value);
}

function fromIdString(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function SpecialForm({ teams, players, initial, isLocked, lockAt }: Props) {
  const [state, setState] = useState<Special>(initial ?? EMPTY);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>(JSON.stringify(initial ?? EMPTY));

  useEffect(() => {
    if (isLocked) return;
    const key = JSON.stringify(state);
    if (key === lastSaved.current) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("saving");
      setError(null);
      const result = await upsertSpecial({
        championTeamId: state.champion_team_id,
        runnerUpTeamId: state.runner_up_team_id,
        topScorerPlayerId: state.top_scorer_player_id,
        mvpPlayerId: state.mvp_player_id,
        bestGkPlayerId: state.best_gk_player_id,
      });
      if (result.ok) {
        lastSaved.current = key;
        setStatus("saved");
      } else {
        setStatus("error");
        setError(result.error);
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state, isLocked]);

  type TeamOption = ComboboxOption & { team: Team };
  type PlayerOption = ComboboxOption & { player: Player };

  const teamOptions: TeamOption[] = useMemo(
    () =>
      teams.map((t) => ({
        value: String(t.id),
        label: teamName(t.fifa_code, t.name),
        // Index Spanish name + English fallback + fifa code so the search
        // works whether the user types "Brasil", "Brazil", or "BRA".
        keywords: [t.name, t.fifa_code],
        team: t,
      })),
    [teams],
  );

  const playerOptions: PlayerOption[] = useMemo(
    () =>
      players.map((p) => ({
        value: String(p.id),
        label: p.name,
        // Searchable by team code + position. Surname is already in `name`
        // (api-football ships "T. Payne", "L. Messi" — the substringFilter
        // normalizes that to "t payne" / "l messi", so typing "payne" or
        // "messi" hits). First names aren't indexed by design: same-surname
        // ambiguities get disambiguated by the country flag / jersey number
        // shown in each row.
        searchText: `${p.team?.fifa_code ?? ""} ${p.position ?? ""}`,
        player: p,
      })),
    [players],
  );

  const onlyGKOptions = useMemo(
    () => playerOptions.filter((o) => o.player.position === "GK"),
    [playerOptions],
  );

  const playersAvailable = playerOptions.length > 0;

  const update = <K extends keyof Special>(key: K, value: Special[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const filled = Object.values(state).filter((v) => v !== null).length;

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Predicciones especiales
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              5 selecciones de torneo. Se resuelven al final del Mundial.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-border bg-card px-3 py-1.5 text-sm">
              <span className="font-semibold tabular-nums">{filled}</span>
              <span className="text-muted-foreground"> / 5 cargados</span>
            </div>
            <StatusBadge status={status} error={error} />
          </div>
        </div>

        {isLocked ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
            Especiales cerrados desde el kickoff del Mundial.
          </div>
        ) : lockAt ? (
          <p className="text-xs text-muted-foreground">
            Lock al kickoff del 1er partido —{" "}
            <span className="font-medium text-foreground">
              {new Date(lockAt).toLocaleString("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
                day: "2-digit",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          icon={<Trophy className="h-4 w-4" />}
          label="Campeón"
          hint="4 puntos"
          accent="text-amber-600 dark:text-amber-400"
        >
          <Combobox<TeamOption>
            options={teamOptions}
            value={toIdString(state.champion_team_id)}
            onChange={(v) => update("champion_team_id", fromIdString(v))}
            placeholder="Elegir campeón"
            searchPlaceholder="Buscar selección..."
            renderOption={(opt, { selected }) => (
              <TeamRow team={opt.team} selected={selected} />
            )}
            renderValue={(opt) => <TeamRow team={opt.team} compact />}
            disabled={isLocked}
          />
        </Field>

        <Field
          icon={<Medal className="h-4 w-4" />}
          label="Subcampeón"
          hint="3 puntos"
          accent="text-zinc-500"
        >
          <Combobox<TeamOption>
            options={teamOptions}
            value={toIdString(state.runner_up_team_id)}
            onChange={(v) => update("runner_up_team_id", fromIdString(v))}
            placeholder="Elegir subcampeón"
            searchPlaceholder="Buscar selección..."
            renderOption={(opt, { selected }) => (
              <TeamRow team={opt.team} selected={selected} />
            )}
            renderValue={(opt) => <TeamRow team={opt.team} compact />}
            disabled={isLocked}
          />
        </Field>

        <PlayerField
          icon={<Target className="h-4 w-4" />}
          label="Goleador"
          hint="3 puntos · bota de oro"
          accent="text-rose-600 dark:text-rose-400"
          value={toIdString(state.top_scorer_player_id)}
          onChange={(v) => update("top_scorer_player_id", fromIdString(v))}
          options={playerOptions}
          available={playersAvailable}
          disabled={isLocked}
        />

        <PlayerField
          icon={<Star className="h-4 w-4" />}
          label="MVP"
          hint="3 puntos · mejor jugador"
          accent="text-blue-600 dark:text-blue-400"
          value={toIdString(state.mvp_player_id)}
          onChange={(v) => update("mvp_player_id", fromIdString(v))}
          options={playerOptions}
          available={playersAvailable}
          disabled={isLocked}
        />

        <PlayerField
          icon={<Shield className="h-4 w-4" />}
          label="Mejor arquero"
          hint="1 punto · guante de oro"
          accent="text-amber-600 dark:text-amber-400"
          value={toIdString(state.best_gk_player_id)}
          onChange={(v) => update("best_gk_player_id", fromIdString(v))}
          options={onlyGKOptions}
          available={onlyGKOptions.length > 0}
          disabled={isLocked}
          gkOnly
        />
      </div>
    </section>
  );
}

function Field({
  icon,
  label,
  hint,
  accent,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg bg-muted ${accent}`}
          >
            {icon}
          </span>
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {hint}
        </span>
      </div>
      {children}
    </div>
  );
}

function PlayerField({
  icon,
  label,
  hint,
  accent,
  value,
  onChange,
  options,
  available,
  disabled,
  gkOnly,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  accent: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: Array<ComboboxOption & { player: Player }>;
  available: boolean;
  disabled: boolean;
  gkOnly?: boolean;
}) {
  if (!available) {
    return (
      <Field icon={icon} label={label} hint={hint} accent={accent}>
        <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
          {gkOnly
            ? "Sin arqueros cargados todavía."
            : "Pendiente: el admin tiene que cargar el roster oficial cuando FIFA lo publique (~2 semanas antes del Mundial)."}
        </div>
      </Field>
    );
  }
  return (
    <Field icon={icon} label={label} hint={hint} accent={accent}>
      <Combobox
        options={options}
        value={value}
        onChange={onChange}
        placeholder={`Elegir ${label.toLowerCase()}`}
        searchPlaceholder="Buscar jugador..."
        renderOption={(opt, { selected }) => (
          <PlayerRow player={opt.player} selected={selected} />
        )}
        renderValue={(opt) => <PlayerRow player={opt.player} compact />}
        disabled={disabled}
      />
    </Field>
  );
}

function TeamRow({
  team,
  selected,
  compact,
}: {
  team: Team;
  selected?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex w-full items-center gap-2">
      {!compact ? (
        <Check
          className={`h-4 w-4 shrink-0 ${selected ? "text-primary opacity-100" : "opacity-0"}`}
        />
      ) : null}
      <Flag flagUrl={team.flag_url} size={compact ? "sm" : "md"} />
      <span className={`flex-1 truncate ${compact ? "text-sm" : "text-sm font-medium"}`}>
        {teamName(team.fifa_code, team.name)}
      </span>
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {team.fifa_code}
      </span>
    </div>
  );
}

function PlayerRow({
  player,
  selected,
  compact,
}: {
  player: Player;
  selected?: boolean;
  compact?: boolean;
}) {
  const pos = player.position ? POS_TINT[player.position] : null;
  return (
    <div className="flex w-full items-center gap-2">
      {!compact ? (
        <Check
          className={`h-4 w-4 shrink-0 ${selected ? "text-primary opacity-100" : "opacity-0"}`}
        />
      ) : null}
      {pos ? (
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${pos.cls}`}
        >
          {pos.label}
        </span>
      ) : null}
      <span className={`flex-1 truncate ${compact ? "text-sm" : "text-sm"}`}>
        {player.name}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        {player.jersey_number != null ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            #{player.jersey_number}
          </span>
        ) : null}
        {player.team?.flag_url ? (
          <Flag flagUrl={player.team.flag_url} size="sm" />
        ) : null}
      </div>
    </div>
  );
}

function Flag({
  flagUrl,
  size,
}: {
  flagUrl: string | null;
  size: "sm" | "md";
}) {
  const dims = size === "sm" ? "h-4 w-6" : "h-5 w-7";
  if (!flagUrl) {
    return <div className={`shrink-0 rounded-sm bg-muted ${dims}`} aria-hidden="true" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagUrl}
      alt=""
      className={`shrink-0 rounded-sm object-cover ring-1 ring-foreground/10 ${dims}`}
      loading="lazy"
    />
  );
}

function StatusBadge({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === "saving")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
        guardando
      </span>
    );
  if (status === "saved")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        guardado
      </span>
    );
  if (status === "error")
    return (
      <span
        className="inline-flex items-center gap-1.5 text-sm text-destructive"
        title={error ?? undefined}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
        error
      </span>
    );
  return null;
}
