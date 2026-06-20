import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { MatchCard } from "@/components/MatchCard";
import { BetSlip } from "@/components/BetSlip";
import { BottomNav } from "@/components/BottomNav";
import { SearchBar } from "@/components/SearchBar";
import { HighlightsCarousel } from "@/components/HighlightsCarousel";
import { fetchLiveMatches, fetchTodayMatches, type NormalizedMatch } from "@/lib/footballApi";
import type { BetSlipItem } from "@/lib/mockData";
import { Zap, Calendar, CheckCircle, Loader2, RefreshCw, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLeagueRank } from "@/lib/footballApi";

const Index = () => {
  const [betSlip, setBetSlip] = useState<BetSlipItem[]>([]);
  const [filter, setFilter] = useState<"all" | "live" | "upcoming" | "ended">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"highlights" | "time" | "league">("highlights");

  const { data: liveMatches = [], isLoading: loadingLive, refetch: refetchLive } = useQuery({
    queryKey: ["live-matches"],
    queryFn: fetchLiveMatches,
    refetchInterval: 30000,
    staleTime: 20000,
    gcTime: 60000,
    retry: 1,
    retryDelay: 2000,
  });

  const { data: todayMatches = [], isLoading: loadingToday, refetch: refetchToday } = useQuery({
    queryKey: ["today-matches"],
    queryFn: fetchTodayMatches,
    refetchInterval: 60000,
    staleTime: 30000,
    gcTime: 120000,
    retry: 1,
    retryDelay: 2000,
  });

  // Merge and deduplicate
  const allMatches: NormalizedMatch[] = [];
  const seenIds = new Set<number>();
  
  // Live matches first
  for (const m of liveMatches) {
    if (!seenIds.has(m.id)) { seenIds.add(m.id); allMatches.push(m); }
  }
  for (const m of todayMatches) {
    if (!seenIds.has(m.id)) { seenIds.add(m.id); allMatches.push(m); }
  }

  const filteredMatches = allMatches.filter((m) => {
    // Apply status filter
    if (filter === "live" && m.status !== "live") return false;
    if (filter === "upcoming" && m.status !== "upcoming") return false;
    if (filter === "ended" && m.status !== "finished") return false;
    if (filter === "all") {
      // Only show truly upcoming matches: exclude live, finished, and past kickoff time
      if (m.status === "live" || m.status === "finished") return false;
      if (new Date(m.date).getTime() <= Date.now()) return false;
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        m.homeTeam.toLowerCase().includes(query) ||
        m.awayTeam.toLowerCase().includes(query) ||
        m.league.toLowerCase().includes(query) ||
        `${m.homeTeam} vs ${m.awayTeam}`.toLowerCase().includes(query);
      
      return matchesSearch;
    }
    
    return true;
  }).sort((a, b) => {
    if (sortBy === "highlights") {
      // Top 3 leagues: English Premier League, La Liga (Spain), Serie A (Italy) first
      const isTopLeague = (m: NormalizedMatch) => {
        const top3 = [["Premier League", "England"], ["La Liga", "Spain"], ["Serie A", "Italy"]] as const;
        return top3.some(([name, country]) => m.league.includes(name) && m.leagueCountry.toLowerCase() === country.toLowerCase());
      };
      const aIsTop = isTopLeague(a);
      const bIsTop = isTopLeague(b);
      if (aIsTop && !bIsTop) return -1;
      if (!aIsTop && bIsTop) return 1;
      // Within same tier, sort by league rank (popularity)
      return getLeagueRank(a.league) - getLeagueRank(b.league);
    } else if (sortBy === "time") {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    } else {
      // Sort by league name alphabetically
      return a.league.localeCompare(b.league);
    }
  });

  const liveCount = allMatches.filter((m) => m.status === "live").length;
  const endedCount = allMatches.filter((m) => m.status === "finished").length;
  
  // Top 3 elite leagues for live highlights
  const isTop3League = (m: NormalizedMatch) => {
    const top3 = [["Premier League", "England"], ["La Liga", "Spain"], ["Serie A", "Italy"]] as const;
    return top3.some(([name, country]) => m.league.includes(name) && m.leagueCountry.toLowerCase() === country.toLowerCase());
  };
  const liveTop3 = allMatches.filter((m) => m.status === "live" && isTop3League(m));
  // Upcoming hot: only matches that haven't kicked off yet (status must be "upcoming")
  const upcomingHot = allMatches.filter((m) => m.status === "upcoming" && m.isHot);
  const highlightMatches = [...liveTop3, ...upcomingHot].slice(0, 7);
  const isLoading = loadingLive || loadingToday;

  const handleSelectOdd = (matchId: number, match: string, odds: number, market?: string) => {
    const matchData = allMatches.find(m => m.id === matchId);
    const matchName = matchData ? `${matchData.homeTeam} vs ${matchData.awayTeam}` : match;
    
    setBetSlip((prev) => {
      // Check if this exact selection already exists
      const exists = prev.find((item) => item.matchId === matchId && item.selection === (match.split(" — ")[1] || match));
      if (exists) return prev.filter((item) => !(item.matchId === matchId && item.selection === (match.split(" — ")[1] || match)));
      
      return [
        ...prev,
        {
          matchId,
          match: matchName,
          selection: match.includes(" — ") ? match.split(" — ").slice(1).join(" — ") : match,
          odds,
          market,
        },
      ];
    });
  };

  const handleRefresh = () => {
    refetchLive();
    refetchToday();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Highlights Carousel */}
      {highlightMatches.length > 0 && (
        <section className="bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border py-6">
          <div className="container mx-auto px-4">
            <h2 className="text-lg font-heading font-bold text-foreground mb-4">🔥 Upcoming Hot Matches</h2>
            <HighlightsCarousel matches={highlightMatches} onSelectOdd={handleSelectOdd} />
          </div>
        </section>
      )}

      <main className="container mx-auto px-4 py-8">
        {/* Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {[
              { key: "all" as const, label: "All Matches", icon: null },
              { key: "live" as const, label: "Live", icon: <Zap className="w-4 h-4" />, badge: liveCount },
              { key: "upcoming" as const, label: "Upcoming", icon: <Calendar className="w-4 h-4" /> },
              { key: "ended" as const, label: "Ended", icon: <CheckCircle className="w-4 h-4" />, badge: endedCount },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm active:scale-95 ${
                  filter === tab.key
                    ? "bg-primary text-primary-foreground shadow-card"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 active:bg-muted"
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="w-5 h-5 rounded-full bg-live text-primary-foreground text-xs flex items-center justify-center font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex-1 sm:w-64">
              <SearchBar 
                value={searchQuery}
                onSearch={setSearchQuery}
                placeholder="Search teams or matches..."
              />
            </div>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "highlights" | "time" | "league")}
                className="appearance-none pl-8 pr-3 py-2 rounded-lg bg-muted border border-border text-foreground text-xs sm:text-sm font-medium cursor-pointer outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="highlights">Highlights</option>
                <option value="time">Kick-off Time</option>
                <option value="league">League A-Z</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && allMatches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground font-medium">Loading matches</p>
          </div>
        )}

        {/* Match Grid */}
        {!isLoading || allMatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMatches.map((match) => (
              <MatchCard key={match.id} match={match} onSelectOdd={handleSelectOdd} />
            ))}
          </div>
        ) : null}

        {!isLoading && filteredMatches.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium">No matches found</p>
            <p className="text-sm mb-4">
              {searchQuery
                ? `No matches match "${searchQuery}". Try searching for another team or league.`
                : filter === "live"
                ? "No live matches right now. Check back during match times!"
                : "Check back later for upcoming fixtures"}
            </p>
            <button
              onClick={() => { refetchLive(); refetchToday(); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 active:scale-95 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        )}
      </main>

      {/* Bet Slip */}
      <BetSlip
        items={betSlip}
        onRemove={(matchId) => setBetSlip((prev) => prev.filter((i) => i.matchId !== matchId))}
        onClear={() => setBetSlip([])}
      />

      {/* Footer */}
      <footer className="bg-foreground text-background py-8 mt-12 mb-24">
        <div className="container mx-auto px-4 text-center">
          <p className="font-heading font-bold text-xl mb-2">
            Global<span className="text-accent">Bet</span>
          </p>
          <p className="text-sm text-background/60">
            © 2026 GlobalBet. Bet responsibly. 18+ only.
          </p>
        </div>
      </footer>

      {/* Bottom Navigation */}
      <BottomNav betSlipCount={betSlip.length} />
    </div>
  );
};

export default Index;
