import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import type { NormalizedMatch } from "@/lib/footballApi";
import { Markets } from "./Markets";

interface MatchCardProps {
  match: NormalizedMatch;
  onSelectOdd?: (matchId: number, selection: string, odds: number) => void;
}

export function MatchCard({ match, onSelectOdd }: MatchCardProps) {
  const isLive = match.status === "live";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-3 sm:p-4 match-card-hover"
    >
      {/* League & Status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground min-w-0">
          <img src={match.leagueLogo} alt={match.league} className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="font-medium truncate max-w-[90px] sm:max-w-[140px]">{match.league}</span>
          {match.isHot && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs font-bold whitespace-nowrap">
              🔥 HOT
            </span>
          )}
        </div>
        
        {/* Top Right: Time and Status */}
        <div className="flex flex-col items-end gap-1">
          {/* Time */}
          <span className="text-xs font-semibold text-foreground whitespace-nowrap">{match.kickoffEAT}</span>
          
          {/* Status Badge */}
          {isLive ? (
            match.isHalftime ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 text-xs font-bold whitespace-nowrap">
                HT
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-live/10 text-live text-xs font-bold whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-live live-pulse" />
                {match.minute ? `${match.minute}'` : "LIVE"}
              </span>
            )
          ) : match.status === "finished" ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-bold whitespace-nowrap">
              ENDED
            </span>
          ) : (
            <span className="text-xs text-muted-foreground font-medium">{match.dateLabel}</span>
          )}
        </div>
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 text-center min-w-0">
          <img src={match.homeLogo} alt={match.homeTeam} className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1 object-contain" onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).alt = '⚽'; }} />
          <p className="font-heading font-semibold text-[10px] sm:text-xs text-foreground truncate">{match.homeTeam}</p>
        </div>

        <div className="px-2 sm:px-3 text-center">
          {isLive || match.status === "finished" ? (
            <div className="font-heading font-black text-xl sm:text-2xl text-foreground">
              {match.homeScore ?? 0} <span className="text-muted-foreground">-</span> {match.awayScore ?? 0}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground font-medium">VS</div>
          )}
          {match.status === "finished" && (
            <span className="text-[10px] font-bold text-muted-foreground">FT</span>
          )}
        </div>

        <div className="flex-1 text-center min-w-0">
          <img src={match.awayLogo} alt={match.awayTeam} className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1 object-contain" onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).alt = '⚽'; }} />
          <p className="font-heading font-semibold text-[10px] sm:text-xs text-foreground truncate">{match.awayTeam}</p>
        </div>
      </div>

      {/* Main Match Winner Odds - hide for ended matches */}
      {match.status !== "finished" && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-4">
          {[
            { label: "1", value: match.odds.home, selection: "home" },
            { label: "X", value: match.odds.draw, selection: "draw" },
            { label: "2", value: match.odds.away, selection: "away" },
          ].map((odd) => (
            <button
              key={odd.selection}
              onClick={() => onSelectOdd?.(match.id, `${match.homeTeam} vs ${match.awayTeam} — ${odd.label}`, odd.value)}
              className="flex flex-col items-center py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground transition-all duration-150 group cursor-pointer"
            >
              <span className="text-[10px] sm:text-xs text-muted-foreground group-hover:text-primary-foreground/70 font-medium">{odd.label}</span>
              <span className="font-heading font-bold text-xs sm:text-sm">{odd.value.toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}

      {/* All Available Markets - hide for ended matches */}
      {match.status !== "finished" && (
        <>
          {match.markets.length > 0 ? (
            <div className="border-t border-border pt-3 mt-3">
              <Markets
                matchId={match.id}
                matchName={`${match.homeTeam} vs ${match.awayTeam}`}
                initialMarkets={match.markets}
                onSelectOdd={onSelectOdd}
              />
            </div>
          ) : (
            <div className="border-t border-border pt-3 mt-3">
              <Markets
                matchId={match.id}
                matchName={`${match.homeTeam} vs ${match.awayTeam}`}
                onSelectOdd={onSelectOdd}
              />
            </div>
          )}
        </>
      )}

      {isLive && (
        <div className="mt-3 flex items-center justify-center gap-1 text-xs text-accent font-semibold">
          <Zap className="w-3 h-3" /> Live betting available
        </div>
      )}
    </motion.div>
  );
}
