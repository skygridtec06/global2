import { useState, useEffect, useRef } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import type { MarketOdds } from "@/lib/footballApi";
import { fetchAllMarkets } from "@/lib/footballApi";
import { motion, AnimatePresence } from "framer-motion";

interface MarketsProps {
  matchId: number;
  matchName: string;
  initialMarkets?: MarketOdds[];
  onSelectOdd?: (matchId: number, selection: string, odds: number, marketName: string) => void;
}

export function Markets({ matchId, matchName, initialMarkets = [], onSelectOdd }: MarketsProps) {
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(new Set(["Match Winner"]));
  const [markets, setMarkets] = useState<MarketOdds[]>(initialMarkets);
  const [isExpanded, setIsExpanded] = useState(false);
  const hasFetched = useRef(false);

  // Fetch markets immediately on mount if not provided
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      if (initialMarkets.length === 0) {
        fetchAllMarkets(matchId)
          .then(setMarkets)
          .catch(err => {
            console.error("Failed to fetch markets for match", matchId, ":", err);
          });
      }
    }
  }, [matchId, initialMarkets.length]);

  const toggleMarket = (marketName: string) => {
    setExpandedMarkets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(marketName)) {
        newSet.delete(marketName);
      } else {
        newSet.add(marketName);
      }
      return newSet;
    });
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={toggleExpanded}
        className="w-full text-left text-xs font-semibold text-red-500 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-muted/50 active:scale-95 uppercase tracking-wider"
      >
        +{markets.length > 0 ? markets.length : "..."} {markets.length === 1 ? "market" : "markets"}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={toggleExpanded}
        className="w-full text-left text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors uppercase tracking-wider flex items-center justify-between"
      >
        <span>Hide Markets</span>
      </button>

      {markets.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground ml-2">Loading markets...</span>
        </div>
      ) : (
        markets.map((market) => (
          <div key={market.name} className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleMarket(market.name)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
            >
              <span className="text-xs font-semibold text-foreground">{market.name}</span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${
                  expandedMarkets.has(market.name) ? "rotate-180" : ""
                }`}
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
                  <div className={`grid gap-2 p-2 bg-muted/30 ${
                    market.selections.length === 3 ? "grid-cols-3" : "grid-cols-2"
                  }`}>
                    {market.selections.map((selection) => (
                      <button
                        key={selection.name}
                        onClick={() =>
                          onSelectOdd?.(
                            matchId,
                            `${market.name} - ${selection.name}`,
                            selection.odd,
                            market.name
                          )
                        }
                        className="flex flex-col items-center gap-1 p-2 rounded-md bg-card hover:bg-accent/20 border border-border hover:border-accent transition-colors"
                      >
                        <span className="text-xs text-muted-foreground text-center leading-tight">{selection.name}</span>
                        <span className="text-sm font-bold text-accent">{selection.odd.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))
      )}
    </div>
  );
}
