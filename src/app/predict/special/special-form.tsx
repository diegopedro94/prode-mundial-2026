"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { upsertSpecial } from "@/lib/predictions/actions";

type Team = { id: number; name: string; fifa_code: string };
type Player = { id: number; name: string };

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

    setStatus("saving");
    setError(null);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
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

  const teamOptions: ComboboxOption[] = useMemo(
    () => teams.map((t) => ({ value: String(t.id), label: t.name })),
    [teams],
  );
  const playerOptions: ComboboxOption[] = useMemo(
    () => players.map((p) => ({ value: String(p.id), label: p.name })),
    [players],
  );

  const playersAvailable = players.length > 0;

  const update = <K extends keyof Special>(key: K, value: Special[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Predicciones especiales</h1>
          <StatusBadge status={status} error={error} />
        </div>
        {isLocked ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            Especiales cerrados desde el kickoff del Mundial.
          </div>
        ) : lockAt ? (
          <p className="text-xs text-zinc-500">
            Lock al kickoff del 1er partido — {new Date(lockAt).toLocaleString("es-AR")}
          </p>
        ) : null}
      </header>

      <div className="space-y-4">
        <Field label="Campe&oacute;n" hint="Equipo que levanta la copa.">
          <Combobox
            options={teamOptions}
            value={toIdString(state.champion_team_id)}
            onChange={(v) => update("champion_team_id", fromIdString(v))}
            placeholder="Elegir campe&oacute;n"
            searchPlaceholder="Buscar selecci&oacute;n..."
            disabled={isLocked}
          />
        </Field>

        <Field label="Subcampe&oacute;n" hint="Pierde la final.">
          <Combobox
            options={teamOptions}
            value={toIdString(state.runner_up_team_id)}
            onChange={(v) => update("runner_up_team_id", fromIdString(v))}
            placeholder="Elegir subcampe&oacute;n"
            searchPlaceholder="Buscar selecci&oacute;n..."
            disabled={isLocked}
          />
        </Field>

        <PlayerField
          label="Goleador del torneo"
          hint="Bota de oro."
          value={toIdString(state.top_scorer_player_id)}
          onChange={(v) => update("top_scorer_player_id", fromIdString(v))}
          options={playerOptions}
          available={playersAvailable}
          disabled={isLocked}
        />

        <PlayerField
          label="MVP"
          hint="Mejor jugador del torneo."
          value={toIdString(state.mvp_player_id)}
          onChange={(v) => update("mvp_player_id", fromIdString(v))}
          options={playerOptions}
          available={playersAvailable}
          disabled={isLocked}
        />

        <PlayerField
          label="Mejor arquero"
          hint="Guante de oro."
          value={toIdString(state.best_gk_player_id)}
          onChange={(v) => update("best_gk_player_id", fromIdString(v))}
          options={playerOptions}
          available={playersAvailable}
          disabled={isLocked}
        />
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">{label}</label>
      {children}
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function PlayerField({
  label,
  hint,
  value,
  onChange,
  options,
  available,
  disabled,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: ComboboxOption[];
  available: boolean;
  disabled: boolean;
}) {
  if (!available) {
    return (
      <Field label={label} hint={hint}>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Pendiente: el admin tiene que cargar el roster oficial cuando FIFA lo publique
          (~2 semanas antes del Mundial).
        </div>
      </Field>
    );
  }
  return (
    <Field label={label} hint={hint}>
      <Combobox
        options={options}
        value={value}
        onChange={onChange}
        placeholder={`Elegir ${label.toLowerCase()}`}
        searchPlaceholder="Buscar jugador..."
        disabled={disabled}
      />
    </Field>
  );
}

function StatusBadge({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === "saving")
    return <span className="text-sm text-amber-600 dark:text-amber-400">Guardando…</span>;
  if (status === "saved")
    return (
      <span className="text-sm text-emerald-600 dark:text-emerald-400">Guardado &#10003;</span>
    );
  if (status === "error")
    return (
      <span className="text-sm text-red-600 dark:text-red-400" title={error ?? undefined}>
        Error
      </span>
    );
  return null;
}
