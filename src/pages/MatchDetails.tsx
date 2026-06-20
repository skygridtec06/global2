import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { BetSlip } from "@/components/BetSlip";
import { fetchLiveMatches, fetchTodayMatches, fetchAllMarkets, type NormalizedMatch, type MarketOdds } from "@/lib/footballApi";
import type { BetSlipItem } from "@/lib/mockData";
import { ArrowLeft, Zap, Loader2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MatchDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const matchId = Number(id);

  const [betSlip, setBetSlip] = useState<BetSlipItem[]>([]);
  const [markets, setMarkets] = useState<MarketOdds[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(new Set(["Match Winner"]));

  const { data: liveMatches = [] } = useQuery({
    queryKey: ["live-matches"],
    queryFn: fetchLiveMatches,
    refetchInterval: 30000,
    staleTime: 20000,
    gcTime: 60000,
    retry: 1,
  });

  const { data: todayMatches = [] } = useQuery({
    queryKey: ["today-matches"],
    queryFn: fetchTodayMatches,
    staleTime: 30000,
    gcTime: 120000,
    retry: 1,
  });

  // Find the match from cached data
  const match: NormalizedMatch | undefined = [...liveMatches, ...todayMatches].find(m => m.id === matchId);
  const isLiveMatch = match?.status === "live";

  // Fetch all markets for this match, re-fetch periodically for live matches
  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;

    const loadMarkets = () => {
      setLoadingMarkets((prev) => markets.length === 0 ? true : prev);
      fetchAllMarkets(matchId, isLiveMatch)
        .then((data) => {
          if (!cancelled) {
            setMarkets(data);
            if (data.length > 0 && expandedMarkets.size === 0) {
              setExpandedMarkets(new Set(["Match Winner"]));
            }
          }
        })
        .catch(() => { if (!cancelled) setMarkets([]); })
        .finally(() => { if (!cancelled) setLoadingMarkets(false); });
    };

    loadMarkets();

    // For live matches, refresh odds every 30 seconds
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isLiveMatch) {
      interval = setInterval(loadMarkets, 30000);
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [matchId, isLiveMatch]);

  const toggleMarket = (name: string) => {
    setExpandedMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSelectOdd = (mId: number, selection: string, odds: number, market?: string) => {
    const matchName = match ? `${match.homeTeam} vs ${match.awayTeam}` : "Match";
    setBetSlip((prev) => {
      const exists = prev.find((item) => item.matchId === mId && item.selection === selection);
      if (exists) return prev.filter((item) => !(item.matchId === mId && item.selection === selection));
      return [...prev, { matchId: mId, match: matchName, selection, odds, market }];
    });
  };

  if (!match) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground font-medium">Loading match...</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  const isLive = match.status === "live";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-6 max-w-2xl mb-24">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Match Header Card */}
        <div className="bg-card rounded-2xl border border-border p-5 mb-6">
          {/* League */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <img
                src={match.leagueLogo}
                alt={match.league}
                className="w-5 h-5 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <span className="text-sm font-medium text-muted-foreground">{match.league}</span>
              {match.isHot && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs font-bold">
                  🔥 HOT
                </span>
              )}
            </div>
            {isLive && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-live/10 text-live text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-live live-pulse" />
                LIVE {match.minute ? `${match.minute}'` : ""}
              </span>
            )}
          </div>

          {/* Teams & Score */}
          <div className="flex items-center justify-between">
            <div className="flex-1 text-center">
              <img
                src={match.homeLogo}
                alt={match.homeTeam}
                className="w-14 h-14 mx-auto mb-2 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).alt = "⚽"; }}
              />
              <p className="font-heading font-bold text-sm">{match.homeTeam}</p>
            </div>

            <div className="px-4 text-center">
              {isLive || match.status === "finished" ? (
                <>
                  <div className="font-heading font-black text-3xl">
                    {match.homeScore ?? 0} <span className="text-muted-foreground">-</span> {match.awayScore ?? 0}
                  </div>
                  {match.status === "finished" && (
                    <span className="text-xs font-bold text-muted-foreground">FT</span>
                  )}
                  {match.isHalftime && (
                    <span className="text-xs font-bold text-orange-500">HT</span>
                  )}
                </>
              ) : (
                <div>
                  <p className="font-heading font-black text-lg text-primary">{match.kickoffEAT}</p>
                  <p className="text-xs text-muted-foreground font-medium">{match.dateLabel}</p>
                </div>
              )}
            </div>

            <div className="flex-1 text-center">
              <img
                src={match.awayLogo}
                alt={match.awayTeam}
                className="w-14 h-14 mx-auto mb-2 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).alt = "⚽"; }}
              />
              <p className="font-heading font-bold text-sm">{match.awayTeam}</p>
            </div>
          </div>

          {isLive && (
            <div className="mt-4 flex items-center justify-center gap-1 text-xs text-accent font-semibold">
              <Zap className="w-3 h-3" /> Live betting available
            </div>
          )}
        </div>

        {/* Markets Section */}
        {match.status !== "finished" && (
          <div>
            <h2 className="font-heading font-bold text-lg mb-3">All Markets</h2>

            {loadingMarkets ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground ml-2">Loading markets...</span>
              </div>
            ) : markets.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <p className="text-sm">No markets available for this match yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {markets.map((market) => (
                  <div key={market.name} className="bg-card rounded-xl border border-border overflow-hidden">
                    <button
                      onClick={() => toggleMarket(market.name)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm font-semibold text-foreground">{market.name}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground transition-transform ${expandedMarkets.has(market.name) ? "rotate-180" : ""}`}
                      />
                    </button>

                    <AnimatePresence>
                      {expandedMarkets.has(market.name) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-border overflow-hidden"
                        >
                          <div className={`grid gap-2 p-3 bg-muted/20 ${
                            market.selections.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"
                          }`}>
                            {market.selections.map((sel) => {
                              const isSelected = betSlip.some(
                                (item) => item.matchId === matchId && item.selection === `${market.name} - ${sel.name}`
                              );
                              return (
                                <button
                                  key={sel.name}
                                  onClick={() => handleSelectOdd(matchId, `${market.name} - ${sel.name}`, sel.odd, market.name)}
                                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all active:scale-95 ${
                                    isSelected
                                      ? "bg-primary/10 border-primary text-primary"
                                      : "bg-card border-border hover:border-accent hover:bg-accent/10"
                                  }`}
                                >
                                  <span className="text-xs text-muted-foreground text-center leading-tight">{sel.name}</span>
                                  <span className="text-sm font-bold text-accent">{sel.odd.toFixed(2)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <BetSlip
        items={betSlip}
        onRemove={(mId) => setBetSlip((prev) => prev.filter((i) => i.matchId !== mId))}
        onClear={() => setBetSlip([])}
      />

      <BottomNav />
    </div>
  );
};

export default MatchDetails;
