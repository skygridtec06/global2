import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { MatchCard } from "@/components/MatchCard";
import { BetSlip } from "@/components/BetSlip";
import { BottomNav } from "@/components/BottomNav";
import { SearchBar } from "@/components/SearchBar";
import { fetchUpcomingMatches, type NormalizedMatch } from "@/lib/footballApi";
import type { BetSlipItem } from "@/lib/mockData";
import { Loader2, RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

const Upcoming = () => {
  const [betSlip, setBetSlip] = useState<BetSlipItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: upcomingMatches = [], isLoading, refetch } = useQuery({
    queryKey: ["upcoming-matches"],
    queryFn: fetchUpcomingMatches,
    refetchInterval: 120000,
    staleTime: 60000,
    gcTime: 180000,
    retry: 1,
  });

  const filteredMatches = upcomingMatches.filter((m) => {
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
  });

  const handleSelectOdd = (matchId: number, match: string, odds: number, market?: string) => {
    const matchData = upcomingMatches.find((m) => m.id === matchId);
    const matchName = matchData ? `${matchData.homeTeam} vs ${matchData.awayTeam}` : match;

    setBetSlip((prev) => {
      const exists = prev.find(
        (item) => item.matchId === matchId && item.selection === (match.split(" — ")[1] || match)
      );
      if (exists)
        return prev.filter(
          (item) => !(item.matchId === matchId && item.selection === (match.split(" — ")[1] || match))
        );

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
    refetch();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-heading font-bold">Upcoming Matches</h1>
          </div>
          <p className="text-muted-foreground">Next 3 days of fixtures</p>
        </div>

        {/* Filter and Search */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="text-sm font-medium text-muted-foreground">
            {filteredMatches.length} matches found
          </div>

          <div className="flex items-center gap-2">
            <div className="w-64">
              <SearchBar
                value={searchQuery}
                onSearch={setSearchQuery}
                placeholder="Search teams or matches..."
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && filteredMatches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground font-medium">Loading upcoming matches...</p>
          </div>
        )}

        {/* Match Grid */}
        {!isLoading || filteredMatches.length > 0 ? (
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
                : "Check back later for upcoming fixtures"}
            </p>
            <button
              onClick={() => refetch()}
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
          <p className="text-sm text-background/60">© 2026 GlobalBet. Bet responsibly. 18+ only.</p>
        </div>
      </footer>

      {/* Bottom Navigation */}
      <BottomNav betSlipCount={betSlip.length} />
    </div>
  );
};

export default Upcoming;
