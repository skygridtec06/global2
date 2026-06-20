// API-Football integration via edge function

export interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    status: {
      short: string;
      long: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
  };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

export interface ApiOdds {
  fixture: { id: number };
  bookmakers: Array<{
    bets: Array<{
      name: string;
      values: Array<{ value: string; odd: string }>;
    }>;
  }>;
}

export interface MarketOdds {
  name: string;
  selections: Array<{
    name: string;
    odd: number;
  }>;
}

export interface NormalizedMatch {
  id: number;
  league: string;
  leagueLogo: string;
  leagueCountry: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  homeScore?: number;
  awayScore?: number;
  status: "live" | "upcoming" | "finished";
  minute?: number;
  isHalftime: boolean;
  kickoff: string;
  kickoffEAT: string;
  dateLabel: string;
  date: string;
  odds: { home: number; draw: number; away: number };
  markets: MarketOdds[];
  isHot: boolean;
}

type DemoMatchSeed = {
  id: number;
  league: string;
  leagueCountry: string;
  leagueLogo: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  status: "live" | "upcoming" | "finished";
  dayOffset: number;
  hour: number;
  minute: number;
  homeScore?: number;
  awayScore?: number;
  liveMinute?: number;
  odds: { home: number; draw: number; away: number };
};

const FORCE_DEMO_MATCHES = import.meta.env.VITE_USE_DEMO_MATCHES === "true";

const LIVE_STATUSES = ["1H", "2H", "HT", "ET", "P", "BT", "LIVE", "INT"];
const FINISHED_STATUSES = ["FT", "AET", "PEN"];

// Hot leagues (only these 3 get the automatic HOT badge)
// Each entry: [leagueName, country] — country ensures we match ONLY the intended league
const TIER1_LEAGUES: Array<[string, string]> = [
  ["Premier League", "England"], // English Premier League only
  ["La Liga", "Spain"],
  ["Serie A", "Italy"],
];

// All verified/legitimate leagues globally (ranked by popularity)
// Only matches from these leagues will be shown on the app
const VERIFIED_LEAGUES = [
  // Tier 1: Major European Leagues
  "Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1",
  // Tier 2: European Cups & International
  "Champions League", "Europa League", "Conference League", "World Cup", "Euro", "Copa America", "Africa Cup of Nations",
  // Tier 3: Other Major European Leagues
  "Eredivisie", "SuperLiga", "Portuguese League", "Greek Super League",
  // Tier 4: Major Asian Leagues
  "Super League China", "J1 League", "K League 1", "Indian Super League",
  // Tier 5: Major American Leagues
  "MLS", "Liga MX", "Brasileirão", "Argentine Primera", "Colombian League",
  // Tier 6: Other International
  "Championship", "Serie B", "Segunda Division", "Ligue 2",
];

// Determine if a match is "hot" — only English Premier League, La Liga (Spain), Serie A (Italy)
// Must NOT be a youth/reserve match
export function isMatchHot(match: { league: string; leagueCountry: string; homeTeam?: string; awayTeam?: string }): boolean {
  if (isYouthOrReserveMatch(match.league, match.homeTeam, match.awayTeam)) return false;
  return TIER1_LEAGUES.some(([name, country]) => 
    match.league === name && match.leagueCountry.toLowerCase() === country.toLowerCase()
  );
}

// Check if a league is verified/legitimate
export function isVerifiedLeague(leagueName: string): boolean {
  return VERIFIED_LEAGUES.some(league => leagueName.includes(league));
}

// Filter out youth, reserve, and under-age matches
// Checks BOTH league name AND team names for youth indicators
const YOUTH_LEAGUE_PATTERNS = /\bU1[0-9]\b|\bU2[0-3]\b|\bUnder[- ]?\d+\b|\bYouth\b|\bReserve[s]?\b|\bJunior[s]?\b|\bWomen\b|\bPremier League 2\b|\bPrimavera\b|\bII$|\b2$/i;
const YOUTH_TEAM_PATTERNS = /\bU1[0-9]\b|\bU2[0-3]\b|\bUnder[- ]?\d+\b|\bII$|\bB$/i;

export function isYouthOrReserve(leagueName: string): boolean {
  return YOUTH_LEAGUE_PATTERNS.test(leagueName);
}

export function isYouthOrReserveMatch(leagueName: string, homeTeam?: string, awayTeam?: string): boolean {
  if (YOUTH_LEAGUE_PATTERNS.test(leagueName)) return true;
  if (homeTeam && YOUTH_TEAM_PATTERNS.test(homeTeam)) return true;
  if (awayTeam && YOUTH_TEAM_PATTERNS.test(awayTeam)) return true;
  return false;
}

// Get league rank for sorting (1 = most popular)
export function getLeagueRank(leagueName: string): number {
  const index = VERIFIED_LEAGUES.findIndex(league => leagueName.includes(league));
  return index >= 0 ? index + 1 : VERIFIED_LEAGUES.length + 1;
}

// Format time as 12-hour format with AM/PM in East African Time (Africa/Nairobi = UTC+3)
function getEATTime(utcDate: Date): { time: string; dateLabel: string } {
  // Use Intl API to properly convert to Africa/Nairobi timezone (East African Time)
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const time = timeFormatter.format(utcDate);

  // Get the match date in EAT
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const matchDateStr = dateFormatter.format(utcDate);
  const [matchMonth, matchDay, matchYear] = matchDateStr.split("/");
  const matchDate = new Date(`${matchYear}-${matchMonth}-${matchDay}T00:00:00Z`);

  // Get today's date in EAT
  const todayDateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const todayStr = todayDateFormatter.format(new Date());
  const [todayMonth, todayDay, todayYear] = todayStr.split("/");
  const today = new Date(`${todayYear}-${todayMonth}-${todayDay}T00:00:00Z`);

  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  let dateLabel = "";
  if (matchDate.getTime() === today.getTime()) {
    dateLabel = "Today";
  } else if (matchDate.getTime() === tomorrow.getTime()) {
    dateLabel = "Tomorrow";
  } else {
    const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Nairobi",
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    dateLabel = fullDateFormatter.format(utcDate);
  }

  return { time, dateLabel };
}

export function normalizeFixture(f: ApiFixture, markets: MarketOdds[] = []): NormalizedMatch {
  const statusShort = f.fixture.status.short;
  let status: "live" | "upcoming" | "finished" = "upcoming";
  if (LIVE_STATUSES.includes(statusShort)) status = "live";
  else if (FINISHED_STATUSES.includes(statusShort)) status = "finished";

  const isHalftime = statusShort === "HT";

  const date = new Date(f.fixture.date);
  
  // Get properly formatted EAT time and date label
  const { time: kickoffEAT, dateLabel } = getEATTime(date);
  const kickoff = kickoffEAT;

  // Extract Match Winner odds from markets
  const matchWinnerMarket = markets.find(m => m.name === "Match Winner")?.selections || [];
  const home = matchWinnerMarket.find(s => s.name === "Home")?.odd || 1.90;
  const draw = matchWinnerMarket.find(s => s.name === "Draw")?.odd || 3.30;
  const away = matchWinnerMarket.find(s => s.name === "Away")?.odd || 4.00;

  return {
    id: f.fixture.id,
    league: f.league.name,
    leagueLogo: f.league.logo,
    leagueCountry: f.league.country,
    homeTeam: f.teams.home.name,
    awayTeam: f.teams.away.name,
    homeLogo: f.teams.home.logo,
    awayLogo: f.teams.away.logo,
    homeScore: f.goals.home ?? undefined,
    awayScore: f.goals.away ?? undefined,
    status,
    minute: f.fixture.status.elapsed ?? undefined,
    isHalftime,
    kickoff,
    kickoffEAT,
    dateLabel,
    date: date.toISOString(),
    odds: { home, draw, away },
    markets,
    isHot: isMatchHot({ league: f.league.name, leagueCountry: f.league.country, homeTeam: f.teams.home.name, awayTeam: f.teams.away.name }),
  };
}

function buildDemoMatch(seed: DemoMatchSeed): NormalizedMatch {
  const date = new Date();
  date.setDate(date.getDate() + seed.dayOffset);
  date.setHours(seed.hour, seed.minute, 0, 0);

  const { time: kickoffEAT, dateLabel } = getEATTime(date);

  return {
    id: seed.id,
    league: seed.league,
    leagueLogo: seed.leagueLogo,
    leagueCountry: seed.leagueCountry,
    homeTeam: seed.homeTeam,
    awayTeam: seed.awayTeam,
    homeLogo: seed.homeLogo,
    awayLogo: seed.awayLogo,
    homeScore: seed.homeScore,
    awayScore: seed.awayScore,
    status: seed.status,
    minute: seed.liveMinute,
    isHalftime: seed.status === "live" && seed.liveMinute === 45,
    kickoff: kickoffEAT,
    kickoffEAT,
    dateLabel,
    date: date.toISOString(),
    odds: seed.odds,
    markets: [],
    isHot: isMatchHot({
      league: seed.league,
      leagueCountry: seed.leagueCountry,
      homeTeam: seed.homeTeam,
      awayTeam: seed.awayTeam,
    }),
  };
}

function getDemoMatchPool(): NormalizedMatch[] {
  const seeds: DemoMatchSeed[] = [
    {
      id: 9001,
      league: "Premier League",
      leagueCountry: "England",
      leagueLogo: "https://media.api-sports.io/football/leagues/39.png",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      homeLogo: "https://media.api-sports.io/football/teams/42.png",
      awayLogo: "https://media.api-sports.io/football/teams/49.png",
      status: "live",
      dayOffset: 0,
      hour: 19,
      minute: 0,
      homeScore: 2,
      awayScore: 1,
      liveMinute: 67,
      odds: { home: 1.78, draw: 3.9, away: 5.2 },
    },
    {
      id: 9002,
      league: "La Liga",
      leagueCountry: "Spain",
      leagueLogo: "https://media.api-sports.io/football/leagues/140.png",
      homeTeam: "Real Madrid",
      awayTeam: "Barcelona",
      homeLogo: "https://media.api-sports.io/football/teams/541.png",
      awayLogo: "https://media.api-sports.io/football/teams/529.png",
      status: "live",
      dayOffset: 0,
      hour: 21,
      minute: 30,
      homeScore: 1,
      awayScore: 1,
      liveMinute: 38,
      odds: { home: 2.35, draw: 2.95, away: 3.05 },
    },
    {
      id: 9003,
      league: "Serie A",
      leagueCountry: "Italy",
      leagueLogo: "https://media.api-sports.io/football/leagues/135.png",
      homeTeam: "AC Milan",
      awayTeam: "Inter",
      homeLogo: "https://media.api-sports.io/football/teams/489.png",
      awayLogo: "https://media.api-sports.io/football/teams/505.png",
      status: "upcoming",
      dayOffset: 0,
      hour: 22,
      minute: 45,
      odds: { home: 2.65, draw: 3.2, away: 2.7 },
    },
    {
      id: 9004,
      league: "Bundesliga",
      leagueCountry: "Germany",
      leagueLogo: "https://media.api-sports.io/football/leagues/78.png",
      homeTeam: "Bayern Munich",
      awayTeam: "Borussia Dortmund",
      homeLogo: "https://media.api-sports.io/football/teams/157.png",
      awayLogo: "https://media.api-sports.io/football/teams/165.png",
      status: "upcoming",
      dayOffset: 0,
      hour: 20,
      minute: 30,
      odds: { home: 1.62, draw: 4.05, away: 5.45 },
    },
    {
      id: 9005,
      league: "Ligue 1",
      leagueCountry: "France",
      leagueLogo: "https://media.api-sports.io/football/leagues/61.png",
      homeTeam: "PSG",
      awayTeam: "Lyon",
      homeLogo: "https://media.api-sports.io/football/teams/85.png",
      awayLogo: "https://media.api-sports.io/football/teams/80.png",
      status: "finished",
      dayOffset: 0,
      hour: 18,
      minute: 0,
      homeScore: 3,
      awayScore: 1,
      odds: { home: 1.44, draw: 4.8, away: 7.1 },
    },
    {
      id: 9006,
      league: "Premier League",
      leagueCountry: "England",
      leagueLogo: "https://media.api-sports.io/football/leagues/39.png",
      homeTeam: "Liverpool",
      awayTeam: "Manchester City",
      homeLogo: "https://media.api-sports.io/football/teams/40.png",
      awayLogo: "https://media.api-sports.io/football/teams/50.png",
      status: "upcoming",
      dayOffset: 1,
      hour: 17,
      minute: 0,
      odds: { home: 2.45, draw: 3.45, away: 2.75 },
    },
    {
      id: 9007,
      league: "La Liga",
      leagueCountry: "Spain",
      leagueLogo: "https://media.api-sports.io/football/leagues/140.png",
      homeTeam: "Atletico Madrid",
      awayTeam: "Sevilla",
      homeLogo: "https://media.api-sports.io/football/teams/530.png",
      awayLogo: "https://media.api-sports.io/football/teams/536.png",
      status: "upcoming",
      dayOffset: 1,
      hour: 22,
      minute: 0,
      odds: { home: 1.92, draw: 3.15, away: 4.4 },
    },
    {
      id: 9008,
      league: "Serie A",
      leagueCountry: "Italy",
      leagueLogo: "https://media.api-sports.io/football/leagues/135.png",
      homeTeam: "Napoli",
      awayTeam: "Roma",
      homeLogo: "https://media.api-sports.io/football/teams/492.png",
      awayLogo: "https://media.api-sports.io/football/teams/497.png",
      status: "upcoming",
      dayOffset: 2,
      hour: 21,
      minute: 45,
      odds: { home: 2.08, draw: 3.3, away: 3.7 },
    },
    {
      id: 9009,
      league: "Champions League",
      leagueCountry: "World",
      leagueLogo: "https://media.api-sports.io/football/leagues/2.png",
      homeTeam: "Bayern Munich",
      awayTeam: "Real Madrid",
      homeLogo: "https://media.api-sports.io/football/teams/157.png",
      awayLogo: "https://media.api-sports.io/football/teams/541.png",
      status: "upcoming",
      dayOffset: 2,
      hour: 22,
      minute: 0,
      odds: { home: 2.32, draw: 3.35, away: 2.95 },
    },
    {
      id: 9010,
      league: "Portuguese League",
      leagueCountry: "Portugal",
      leagueLogo: "https://media.api-sports.io/football/leagues/94.png",
      homeTeam: "Porto",
      awayTeam: "Benfica",
      homeLogo: "https://media.api-sports.io/football/teams/212.png",
      awayLogo: "https://media.api-sports.io/football/teams/211.png",
      status: "upcoming",
      dayOffset: 0,
      hour: 23,
      minute: 15,
      odds: { home: 2.58, draw: 3.1, away: 2.85 },
    },
  ];

  return seeds
    .map(buildDemoMatch)
    .sort((a, b) => getLeagueRank(a.league) - getLeagueRank(b.league));
}

function getDemoLiveMatches(): NormalizedMatch[] {
  return getDemoMatchPool().filter((m) => m.status === "live");
}

function getDemoTodayMatches(): NormalizedMatch[] {
  return getDemoMatchPool().filter((m) => m.dateLabel === "Today");
}

function getDemoUpcomingMatches(): NormalizedMatch[] {
  const now = Date.now();
  return getDemoMatchPool().filter((m) => m.status === "upcoming" && new Date(m.date).getTime() > now);
}

async function callFootballApi(params: Record<string, string>): Promise<any> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const queryString = new URLSearchParams(params).toString();
  const url = `${supabaseUrl}/functions/v1/football-api?${queryString}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000); // 12s client timeout

  try {
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${anonKey}`,
        "apikey": anonKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Batch fetch odds for a date, returns a map of fixtureId → { home, draw, away }
type OddsMap = Map<number, { home: number; draw: number; away: number }>;

// Fetch PRE-MATCH odds for a single fixture (from /odds endpoint)
async function fetchPreMatchOdds(fixtureId: number): Promise<{ home: number; draw: number; away: number } | null> {
  try {
    const data = await callFootballApi({ endpoint: "odds", fixture: String(fixtureId) });
    if (!data?.response?.length) return null;
    const bookmaker = data.response[0]?.bookmakers?.[0];
    if (!bookmaker) return null;
    const matchWinner = bookmaker.bets?.find((b: any) => b.name === "Match Winner");
    if (!matchWinner) return null;
    const home = parseFloat(matchWinner.values?.find((v: any) => v.value === "Home")?.odd) || 0;
    const draw = parseFloat(matchWinner.values?.find((v: any) => v.value === "Draw")?.odd) || 0;
    const away = parseFloat(matchWinner.values?.find((v: any) => v.value === "Away")?.odd) || 0;
    if (home > 0 && draw > 0 && away > 0) return { home, draw, away };
    return null;
  } catch {
    return null;
  }
}

// Fetch LIVE in-play odds for a fixture (from /odds/live endpoint)
async function fetchLiveOddsFromApi(fixtureId: number): Promise<{ home: number; draw: number; away: number } | null> {
  try {
    const data = await callFootballApi({ endpoint: "odds/live", fixture: String(fixtureId) });
    if (!data?.response?.length) return null;
    // /odds/live has a different response format: response[].odds[] instead of bookmakers[].bets[]
    const oddsArr = data.response[0]?.odds;
    if (Array.isArray(oddsArr)) {
      const matchWinner = oddsArr.find((o: any) => o.name === "Match Winner" || o.id === 1);
      if (matchWinner?.values?.length) {
        const home = parseFloat(matchWinner.values.find((v: any) => v.value === "Home")?.odd) || 0;
        const draw = parseFloat(matchWinner.values.find((v: any) => v.value === "Draw")?.odd) || 0;
        const away = parseFloat(matchWinner.values.find((v: any) => v.value === "Away")?.odd) || 0;
        if (home > 0 && draw > 0 && away > 0) return { home, draw, away };
      }
    }
    // Also try bookmakers format (some responses use this)
    const bookmaker = data.response[0]?.bookmakers?.[0];
    if (bookmaker) {
      const matchWinner = bookmaker.bets?.find((b: any) => b.name === "Match Winner");
      if (matchWinner) {
        const home = parseFloat(matchWinner.values?.find((v: any) => v.value === "Home")?.odd) || 0;
        const draw = parseFloat(matchWinner.values?.find((v: any) => v.value === "Draw")?.odd) || 0;
        const away = parseFloat(matchWinner.values?.find((v: any) => v.value === "Away")?.odd) || 0;
        if (home > 0 && draw > 0 && away > 0) return { home, draw, away };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Calculate realistic in-play odds from match state when API live odds unavailable
function calculateInPlayOdds(
  homeScore: number,
  awayScore: number,
  elapsed: number
): { home: number; draw: number; away: number } {
  const goalDiff = homeScore - awayScore;
  const minutesClamped = Math.max(1, Math.min(elapsed, 90));
  const timeProgress = minutesClamped / 90; // 0..1

  let homeProb: number, drawProb: number, awayProb: number;

  if (goalDiff === 0) {
    // Level match — draw probability rises with time
    drawProb = 0.30 + timeProgress * 0.25;
    homeProb = (1 - drawProb) * 0.52;
    awayProb = (1 - drawProb) * 0.48;
  } else {
    // One team leading
    const absDiff = Math.abs(goalDiff);
    // Leading team's win probability: higher with more goals and more time elapsed
    const leadProb = Math.min(0.97, 0.55 + absDiff * 0.15 + timeProgress * 0.20 + (absDiff * timeProgress * 0.08));
    // Draw probability shrinks with time and goal difference
    drawProb = Math.max(0.015, (0.25 - absDiff * 0.08) * (1 - timeProgress * 0.7));
    const trailProb = Math.max(0.01, 1 - leadProb - drawProb);

    if (goalDiff > 0) {
      homeProb = leadProb;
      awayProb = trailProb;
    } else {
      awayProb = leadProb;
      homeProb = trailProb;
    }
  }

  // Normalize
  const total = homeProb + drawProb + awayProb;
  homeProb /= total;
  drawProb /= total;
  awayProb /= total;

  // Convert to decimal odds with ~7% margin (typical bookmaker)
  const margin = 1.07;
  return {
    home: Math.round((margin / homeProb) * 100) / 100,
    draw: Math.round((margin / drawProb) * 100) / 100,
    away: Math.round((margin / awayProb) * 100) / 100,
  };
}

// Get odds for a live fixture: try live API → pre-match API → calculated
async function fetchLiveFixtureOdds(
  fixtureId: number,
  homeScore: number,
  awayScore: number,
  elapsed: number
): Promise<{ home: number; draw: number; away: number }> {
  // 1. Try live odds endpoint first
  const liveOdds = await fetchLiveOddsFromApi(fixtureId);
  if (liveOdds) return liveOdds;

  // 2. Fall back to calculated in-play odds (always realistic)
  return calculateInPlayOdds(homeScore, awayScore, elapsed);
}

// Fetch pre-match odds for multiple fixtures in parallel batches
async function fetchOddsForFixtures(fixtureIds: number[]): Promise<OddsMap> {
  const oddsMap: OddsMap = new Map();
  if (fixtureIds.length === 0) return oddsMap;

  const batchSize = 10;
  for (let i = 0; i < fixtureIds.length; i += batchSize) {
    const batch = fixtureIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(id => fetchPreMatchOdds(id))
    );
    results.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value) {
        oddsMap.set(batch[idx], result.value);
      }
    });
  }
  return oddsMap;
}

// Fetch live odds for multiple fixtures in parallel batches
async function fetchLiveOddsForFixtures(fixtures: ApiFixture[]): Promise<OddsMap> {
  const oddsMap: OddsMap = new Map();
  if (fixtures.length === 0) return oddsMap;

  const batchSize = 10;
  for (let i = 0; i < fixtures.length; i += batchSize) {
    const batch = fixtures.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(f => fetchLiveFixtureOdds(
        f.fixture.id,
        f.goals.home ?? 0,
        f.goals.away ?? 0,
        f.fixture.status.elapsed ?? 0
      ))
    );
    results.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value) {
        oddsMap.set(batch[idx].fixture.id, result.value);
      }
    });
  }
  return oddsMap;
}

export async function fetchLiveMatches(): Promise<NormalizedMatch[]> {
  if (FORCE_DEMO_MATCHES) {
    return getDemoLiveMatches();
  }

  try {
    const data = await callFootballApi({ endpoint: "fixtures", live: "all" });
    if (!data?.response) return getDemoLiveMatches();
    
    // First filter to verified matches
    const verified = data.response.filter((f: ApiFixture) => 
      f.league?.name && 
      f.teams?.home?.name && 
      f.teams?.away?.name && 
      isVerifiedLeague(f.league.name) &&
      !isYouthOrReserveMatch(f.league.name, f.teams.home.name, f.teams.away.name)
    );

    // Fetch LIVE in-play odds (tries /odds/live API, falls back to calculated)
    const oddsMap = await fetchLiveOddsForFixtures(verified);

    const mapped = verified
      .map((f: ApiFixture) => {
        const match = normalizeFixture(f, []);
        const realOdds = oddsMap.get(f.fixture.id);
        if (realOdds) {
          match.odds = realOdds;
        }
        return match;
      })
      .sort((a: NormalizedMatch, b: NormalizedMatch) => getLeagueRank(a.league) - getLeagueRank(b.league))
      .slice(0, 100);

    return mapped.length > 0 ? mapped : getDemoLiveMatches();
  } catch (error) {
    console.error("Error fetching live matches:", error);
    return getDemoLiveMatches();
  }
}

export async function fetchTodayMatches(): Promise<NormalizedMatch[]> {
  if (FORCE_DEMO_MATCHES) {
    return getDemoTodayMatches();
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const data = await callFootballApi({ endpoint: "fixtures", date: today });
    if (!data?.response) return getDemoTodayMatches();

    const verified = data.response.filter((f: ApiFixture) => 
      f.league?.name && 
      f.teams?.home?.name && 
      f.teams?.away?.name && 
      isVerifiedLeague(f.league.name) &&
      !isYouthOrReserveMatch(f.league.name, f.teams.home.name, f.teams.away.name)
    );

    // Split into live and non-live for different odds strategies
    const liveFixtures = verified.filter((f: ApiFixture) => LIVE_STATUSES.includes(f.fixture.status.short));
    const nonLiveFixtures = verified.filter((f: ApiFixture) => !LIVE_STATUSES.includes(f.fixture.status.short));

    // Fetch live odds for in-play matches, pre-match odds for others
    const [liveOddsMap, preMatchOddsMap] = await Promise.all([
      fetchLiveOddsForFixtures(liveFixtures),
      fetchOddsForFixtures(nonLiveFixtures.map(f => f.fixture.id)),
    ]);

    const mapped = verified
      .map((f: ApiFixture) => {
        const match = normalizeFixture(f, []);
        const realOdds = liveOddsMap.get(f.fixture.id) || preMatchOddsMap.get(f.fixture.id);
        if (realOdds) {
          match.odds = realOdds;
        }
        return match;
      })
      .sort((a: NormalizedMatch, b: NormalizedMatch) => getLeagueRank(a.league) - getLeagueRank(b.league))
      .slice(0, 100);

    return mapped.length > 0 ? mapped : getDemoTodayMatches();
  } catch (error) {
    console.error("Error fetching today matches:", error);
    return getDemoTodayMatches();
  }
}

export async function fetchUpcomingMatches(): Promise<NormalizedMatch[]> {
  if (FORCE_DEMO_MATCHES) {
    return getDemoUpcomingMatches();
  }

  try {
    const dates: string[] = [];
    for (let i = 0; i <= 2; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    
    // Fetch all dates fixtures in parallel
    const fixtureResults = await Promise.all(
      dates.map(date => callFootballApi({ endpoint: "fixtures", date }).catch(() => null))
    );

    // Collect all verified fixtures first
    const allVerified: ApiFixture[] = [];
    for (const data of fixtureResults) {
      if (data?.response) {
        const verified = data.response.filter((f: ApiFixture) => {
          const s = f.fixture.status.short;
          return !FINISHED_STATUSES.includes(s) &&
            f.league?.name && 
            f.teams?.home?.name && 
            f.teams?.away?.name && 
            isVerifiedLeague(f.league.name) &&
            !isYouthOrReserveMatch(f.league.name, f.teams.home.name, f.teams.away.name);
        });
        allVerified.push(...verified);
      }
    }

    // Fetch real odds for all verified upcoming fixtures
    const fixtureIds = allVerified.map(f => f.fixture.id);
    const oddsMap = await fetchOddsForFixtures(fixtureIds);

    const allMatches = allVerified.map((f: ApiFixture) => {
      const match = normalizeFixture(f, []);
      const realOdds = oddsMap.get(f.fixture.id);
      if (realOdds) {
        match.odds = realOdds;
      }
      return match;
    });

    // Sort by league popularity and limit total to 300
    const mapped = allMatches
      .sort((a, b) => getLeagueRank(a.league) - getLeagueRank(b.league))
      .slice(0, 300);

    return mapped.length > 0 ? mapped : getDemoUpcomingMatches();
  } catch (error) {
    console.error("Error fetching upcoming matches:", error);
    return getDemoUpcomingMatches();
  }
}

export async function fetchMatchOdds(fixtureId: number, isLive = false): Promise<{ home: number; draw: number; away: number } | null> {
  try {
    // For live matches, try /odds/live first
    if (isLive) {
      const liveOdds = await fetchLiveOddsFromApi(fixtureId);
      if (liveOdds) return liveOdds;
    }
    // Fall back to pre-match odds
    const data = await callFootballApi({ endpoint: "odds", fixture: String(fixtureId) });
    if (!data?.response?.length) return null;
    
    const bookmaker = data.response[0]?.bookmakers?.[0];
    if (!bookmaker) return null;
    
    const matchWinner = bookmaker.bets.find((b: any) => b.name === "Match Winner");
    if (!matchWinner) return null;

    const home = matchWinner.values.find((v: any) => v.value === "Home")?.odd;
    const draw = matchWinner.values.find((v: any) => v.value === "Draw")?.odd;
    const away = matchWinner.values.find((v: any) => v.value === "Away")?.odd;

    return {
      home: parseFloat(home) || 1.90,
      draw: parseFloat(draw) || 3.30,
      away: parseFloat(away) || 4.00,
    };
  } catch {
    return null;
  }
}

// Build a full selection label including handicap/line when present
function buildSelectionName(value: string, handicap: string | null | undefined): string {
  if (!handicap || handicap === "null") return value;
  // Some values already contain the handicap (e.g., "Home +1"), skip duplication
  if (value.includes(handicap)) return value;
  return `${value} ${handicap}`;
}

// Parse markets from a bookmaker bets array (pre-match format)
// Groups same-named bets with different handicap lines into a single market
function parseMarketsFromBookmaker(bookmaker: any): MarketOdds[] {
  const marketMap = new Map<string, MarketOdds>();
  
  bookmaker.bets.forEach((bet: any) => {
    const selections = bet.values.map((v: any) => ({
      name: buildSelectionName(v.value, v.handicap),
      odd: parseFloat(v.odd) || 0,
    })).filter((s: any) => s.odd > 0);
    
    if (selections.length === 0) return;
    
    const existing = marketMap.get(bet.name);
    if (existing) {
      existing.selections.push(...selections);
    } else {
      marketMap.set(bet.name, { name: bet.name, selections });
    }
  });
  
  return Array.from(marketMap.values());
}

// Parse markets from live odds array (/odds/live format)
function parseMarketsFromLiveOdds(oddsArr: any[]): MarketOdds[] {
  const marketMap = new Map<string, MarketOdds>();
  
  oddsArr.forEach((o: any) => {
    const selections = (o.values || []).map((v: any) => ({
      name: buildSelectionName(v.value, v.handicap),
      odd: parseFloat(v.odd) || 0,
    })).filter((s: any) => s.odd > 0);
    
    if (selections.length === 0) return;
    
    const existing = marketMap.get(o.name);
    if (existing) {
      existing.selections.push(...selections);
    } else {
      marketMap.set(o.name, { name: o.name, selections });
    }
  });
  
  return Array.from(marketMap.values());
}

export async function fetchAllMarkets(fixtureId: number, isLive = false): Promise<MarketOdds[]> {
  try {
    // For live matches, try /odds/live first for real-time markets
    if (isLive) {
      try {
        const liveData = await callFootballApi({ endpoint: "odds/live", fixture: String(fixtureId) });
        if (liveData?.response?.length) {
          const resp = liveData.response[0];
          // Try direct odds array format
          if (Array.isArray(resp?.odds) && resp.odds.length > 0) {
            return parseMarketsFromLiveOdds(resp.odds);
          }
          // Try bookmakers format
          if (resp?.bookmakers?.[0]) {
            return parseMarketsFromBookmaker(resp.bookmakers[0]);
          }
        }
      } catch {
        // Fall through to pre-match odds
      }
    }

    // Pre-match odds fallback
    const data = await callFootballApi({ endpoint: "odds", fixture: String(fixtureId) });
    if (!data?.response?.length) return [];
    
    const bookmaker = data.response[0]?.bookmakers?.[0];
    if (!bookmaker) return [];
    
    return parseMarketsFromBookmaker(bookmaker);
  } catch (error) {
    console.error("Error fetching markets:", error);
    return [];
  }
}
