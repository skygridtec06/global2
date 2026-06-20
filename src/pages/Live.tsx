import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { MatchCard } from "@/components/MatchCard";
import { BetSlip } from "@/components/BetSlip";
import { BottomNav } from "@/components/BottomNav";
import { SearchBar } from "@/components/SearchBar";
import { fetchLiveMatches, type NormalizedMatch } from "@/lib/footballApi";
import type { BetSlipItem } from "@/lib/mockData";
import { Zap, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const Live = () => {
  const [betSlip, setBetSlip] = useState<BetSlipItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: liveMatches = [], isLoading, refetch } = useQuery({
    queryKey: ["live-matches"],
    queryFn: fetchLiveMatches,
    refetchInterval: 30000,
    staleTime: 20000,
    gcTime: 60000,
    retry: 1,
  });

  const filteredMatches = liveMatches.filter((m) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      m.homeTeam.toLowerCase().includes(query) ||
      m.awayTeam.toLowerCase().includes(query) ||
      m.league.toLowerCase().includes(query)
    );
  });

  const handleSelectOdd = (matchId: number, match: string, odds: number, market?: string) => {
    const matchData = liveMatches.find(m => m.id === matchId);
    const matchName = matchData ? `${matchData.homeTeam} vs ${matchData.awayTeam}` : match;

    setBetSlip((prev) => {
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-live" />
            <h1 className="text-2xl font-heading font-bold">Live Matches</h1>
            {liveMatches.length > 0 && (
              <span className="w-6 h-6 rounded-full bg-live text-primary-foreground text-xs flex items-center justify-center font-bold">
                {liveMatches.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-64">
              <SearchBar value={searchQuery} onSearch={setSearchQuery} placeholder="Search live matches..." />
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {isLoading && liveMatches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground font-medium">Loading live matches</p>
          </div>
        )}

        {!isLoading || liveMatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMatches.map((match) => (
              <MatchCard key={match.id} match={match} onSelectOdd={handleSelectOdd} />
            ))}
          </div>
        ) : null}

        {!isLoading && filteredMatches.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium">No live matches right now</p>
            <p className="text-sm">Check back during match times!</p>
          </div>
        )}
      </main>

      <BetSlip
        items={betSlip}
        onRemove={(matchId) => setBetSlip((prev) => prev.filter((i) => i.matchId !== matchId))}
        onClear={() => setBetSlip([])}
      />

      <footer className="bg-foreground text-background py-8 mt-12 mb-24">
        <div className="container mx-auto px-4 text-center">
          <p className="font-heading font-bold text-xl mb-2">
            Global<span className="text-primary">Bet</span>
          </p>
          <p className="text-sm text-background/60">© 2026 GlobalBet. Bet responsibly. 18+ only.</p>
        </div>
      </footer>

      <BottomNav betSlipCount={betSlip.length} />
    </div>
  );
};

export default Live;
