const BASE_URL = "https://v3.football.api-sports.io";

export type ApiFootballTeam = {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string | null;
    logo: string | null;
  };
};

export type ApiFootballStanding = {
  rank: number;
  team: { id: number; name: string };
  group: string;
};

export type ApiFootballLeagueStandings = {
  league: {
    id: number;
    name: string;
    season: number;
    standings: ApiFootballStanding[][];
  };
};

export type ApiFootballPlayerSquad = {
  player: {
    id: number;
    name: string;
    age: number | null;
    number: number | null;
    position: string | null;
    photo: string | null;
  };
};

export type ApiFootballSquad = {
  team: { id: number; name: string };
  players: ApiFootballPlayerSquad["player"][];
};

type Envelope<T> = {
  errors: unknown;
  results: number;
  response: T;
};

export class ApiFootballError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
  }
}

export function createApiFootballClient(options?: { apiKey?: string }) {
  const apiKey = options?.apiKey ?? process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    throw new Error("API_FOOTBALL_KEY is not set");
  }

  async function request<T>(path: string, params: Record<string, string | number>) {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    const res = await fetch(url, {
      headers: { "x-apisports-key": apiKey! },
    });
    if (!res.ok) {
      throw new ApiFootballError(
        `api-football ${path} returned ${res.status}`,
        res.status,
        await res.text(),
      );
    }
    const body = (await res.json()) as Envelope<T>;
    return body.response;
  }

  return {
    listTeams(params: { league: number; season: number }) {
      return request<ApiFootballTeam[]>("/teams", params);
    },
    listStandings(params: { league: number; season: number }) {
      return request<ApiFootballLeagueStandings[]>("/standings", params);
    },
    listSquad(params: { team: number }) {
      return request<ApiFootballSquad[]>("/players/squads", params);
    },
  };
}

export type ApiFootballClient = ReturnType<typeof createApiFootballClient>;
