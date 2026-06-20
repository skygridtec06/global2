export interface Match {
  id: number;
  league: string;
  leagueLogo: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  homeScore?: number;
  awayScore?: number;
  status: 'live' | 'upcoming' | 'finished';
  minute?: number;
  kickoff: string;
  odds: { home: number; draw: number; away: number };
}

export const mockMatches: Match[] = [
  {
    id: 1,
    league: "Premier League",
    leagueLogo: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    homeLogo: "⚽",
    awayLogo: "⚽",
    homeScore: 2,
    awayScore: 1,
    status: "live",
    minute: 67,
    kickoff: "17:00",
    odds: { home: 1.85, draw: 3.40, away: 4.20 },
  },
  {
    id: 2,
    league: "La Liga",
    leagueLogo: "🇪🇸",
    homeTeam: "Real Madrid",
    awayTeam: "Barcelona",
    homeLogo: "⚽",
    awayLogo: "⚽",
    homeScore: 1,
    awayScore: 1,
    status: "live",
    minute: 34,
    kickoff: "22:00",
    odds: { home: 2.10, draw: 3.25, away: 3.10 },
  },
  {
    id: 3,
    league: "Serie A",
    leagueLogo: "🇮🇹",
    homeTeam: "AC Milan",
    awayTeam: "Inter Milan",
    homeLogo: "⚽",
    awayLogo: "⚽",
    status: "upcoming",
    kickoff: "20:45",
    odds: { home: 2.50, draw: 3.10, away: 2.80 },
  },
  {
    id: 4,
    league: "Bundesliga",
    leagueLogo: "🇩🇪",
    homeTeam: "Bayern Munich",
    awayTeam: "Dortmund",
    homeLogo: "⚽",
    awayLogo: "⚽",
    status: "upcoming",
    kickoff: "22:30",
    odds: { home: 1.65, draw: 3.80, away: 5.00 },
  },
  {
    id: 5,
    league: "Ligue 1",
    leagueLogo: "🇫🇷",
    homeTeam: "PSG",
    awayTeam: "Lyon",
    homeLogo: "⚽",
    awayLogo: "⚽",
    status: "upcoming",
    kickoff: "23:00",
    odds: { home: 1.40, draw: 4.50, away: 7.50 },
  },
  {
    id: 6,
    league: "Premier League",
    leagueLogo: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    homeTeam: "Liverpool",
    awayTeam: "Man City",
    homeLogo: "⚽",
    awayLogo: "⚽",
    homeScore: 3,
    awayScore: 2,
    status: "live",
    minute: 89,
    kickoff: "19:30",
    odds: { home: 1.12, draw: 8.00, away: 15.0 },
  },
];

export interface BetSlipItem {
  matchId: number;
  match: string;
  selection: string;
  odds: number;
  market?: string;
}

export const countries = [
  { code: "KE", name: "Kenya", flag: "🇰🇪", currency: "KES", prefix: "+254" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", currency: "TZS", prefix: "+255" },
  { code: "UG", name: "Uganda", flag: "🇺🇬", currency: "UGX", prefix: "+256" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", currency: "NGN", prefix: "+234" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", currency: "GHS", prefix: "+233" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", currency: "ZAR", prefix: "+27" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹", currency: "ETB", prefix: "+251" },
  { code: "CM", name: "Cameroon", flag: "🇨🇲", currency: "XAF", prefix: "+237" },
];

export const mockUsers = [
  { id: 1, name: "John Kamau", email: "john@example.com", country: "Kenya", balance: 5400, status: "active", bets: 23 },
  { id: 2, name: "Amina Said", email: "amina@example.com", country: "Tanzania", balance: 12000, status: "active", bets: 45 },
  { id: 3, name: "Obi Nwosu", email: "obi@example.com", country: "Nigeria", balance: 890, status: "suspended", bets: 8 },
  { id: 4, name: "Grace Achieng", email: "grace@example.com", country: "Kenya", balance: 34500, status: "active", bets: 102 },
  { id: 5, name: "Kwame Asante", email: "kwame@example.com", country: "Ghana", balance: 2100, status: "active", bets: 17 },
];

export const mockTransactions = [
  { id: 1, user: "John Kamau", type: "deposit", amount: 1000, method: "M-Pesa", status: "completed", date: "2026-03-13 14:30" },
  { id: 2, user: "Amina Said", type: "withdrawal", amount: 5000, method: "M-Pesa", status: "pending", date: "2026-03-13 13:15" },
  { id: 3, user: "Grace Achieng", type: "deposit", amount: 2500, method: "M-Pesa", status: "completed", date: "2026-03-13 12:00" },
  { id: 4, user: "Obi Nwosu", type: "bet", amount: 500, method: "Balance", status: "completed", date: "2026-03-13 11:45" },
  { id: 5, user: "Kwame Asante", type: "winning", amount: 3200, method: "Balance", status: "completed", date: "2026-03-13 10:30" },
];
