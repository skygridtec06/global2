import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { NormalizedMatch } from "@/lib/footballApi";

interface HighlightsCarouselProps {
  matches: NormalizedMatch[];
  onSelectOdd?: (matchId: number, selection: string, odds: number) => void;
}

export function HighlightsCarousel({ matches }: HighlightsCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(true);
  const isResettingRef = useRef(false);
  const navigate = useNavigate();

  // Create multiple duplicates for seamless looping
  const displayMatches = [...matches, ...matches, ...matches];

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || matches.length === 0) return;

    let startTime = Date.now();
    const scrollSpeed = 0.08; // pixels per millisecond (constant, readable speed)
    const singleSetWidth = container.scrollWidth / 3; // Width of one complete set (since we have 3x)
    const initialScrollPosition = singleSetWidth * 0.5;

    const scroll = () => {
      if (!isScrolling || !container || isResettingRef.current) return;

      const now = Date.now();
      const elapsedTime = now - startTime;
      let newScrollPosition = initialScrollPosition + (scrollSpeed * elapsedTime);

      // Reset seamlessly when reaching the second set (visually undetectable)
      if (newScrollPosition >= singleSetWidth * 1.5) {
        isResettingRef.current = true;
        const excess = newScrollPosition - singleSetWidth * 1.5;
        newScrollPosition = singleSetWidth * 0.5 + excess;
        startTime = now;
        isResettingRef.current = false;
      }

      container.scrollLeft = newScrollPosition;
      requestAnimationFrame(scroll);
    };

    // Start with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      // Set initial scroll position to middle set
      container.scrollLeft = initialScrollPosition;
      startTime = Date.now();
      requestAnimationFrame(scroll);
    }, 100);

    const handleMouseEnter = () => setIsScrolling(false);
    const handleMouseLeave = () => {
      startTime = Date.now();
      setIsScrolling(true);
    };

    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      clearTimeout(timeoutId);
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isScrolling, matches.length]);

  return (
    <div
      ref={scrollContainerRef}
      className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
      style={{ scrollBehavior: "auto" }}
    >
      {displayMatches.map((match, idx) => (
        <motion.div
          key={`${match.id}-${idx}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex-shrink-0 w-44 sm:w-56 bg-card rounded-lg border border-border p-2 sm:p-3 cursor-pointer hover:border-primary/40 transition-colors active:scale-[0.98]"
          onClick={() => navigate(`/match/${match.id}`)}
        >
          {/* League */}
          <div className="flex items-center gap-1 mb-2">
            <img
              src={match.leagueLogo}
              alt={match.league}
              className="w-4 h-4 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="text-xs text-muted-foreground font-medium truncate">
              {match.league}
            </span>
            {match.isHot && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold ml-auto whitespace-nowrap">
                🔥 HOT
              </span>
            )}
          </div>

          {/* Teams & Kickoff */}
          <div className="mb-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 text-center">
                <img
                  src={match.homeLogo}
                  alt={match.homeTeam}
                  className="w-6 h-6 mx-auto mb-1 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "";
                    (e.target as HTMLImageElement).alt = "⚽";
                  }}
                />
                <p className="text-[0.65rem] font-semibold text-foreground truncate leading-tight">
                  {match.homeTeam}
                </p>
              </div>

              <div className="text-center px-1">
                {match.status === "live" ? (
                  <>
                    <div className="text-sm font-black text-foreground">
                      {match.homeScore ?? 0} - {match.awayScore ?? 0}
                    </div>
                    {match.isHalftime ? (
                      <span className="text-[10px] font-bold text-orange-500">HT</span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-live">
                        <span className="w-1 h-1 rounded-full bg-live live-pulse" />
                        {match.minute ? `${match.minute}'` : "LIVE"}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold text-primary">{match.kickoffEAT}</p>
                    <p className="text-[10px] text-muted-foreground">{match.dateLabel}</p>
                  </>
                )}
              </div>

              <div className="flex-1 text-center">
                <img
                  src={match.awayLogo}
                  alt={match.awayTeam}
                  className="w-6 h-6 mx-auto mb-1 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "";
                    (e.target as HTMLImageElement).alt = "⚽";
                  }}
                />
                <p className="text-[0.65rem] font-semibold text-foreground truncate leading-tight">
                  {match.awayTeam}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
