import { useState } from "react";
import { X, Trash2, ChevronUp, ChevronDown, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BetSlipItem } from "@/lib/mockData";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { addBet } from "@/lib/transactionStore";

interface BetSlipProps {
  items: BetSlipItem[];
  onRemove: (matchId: number) => void;
  onClear: () => void;
}

export function BetSlip({ items, onRemove, onClear }: BetSlipProps) {
  const [stake, setStake] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [betPlaced, setBetPlaced] = useState(false);
  const [betError, setBetError] = useState("");
  const { user, updateBalance } = useAuth();

  const totalOdds = items.reduce((acc, item) => acc * item.odds, 1);
  const potentialWin = stake ? (parseFloat(stake) * totalOdds).toFixed(2) : "0.00";

  if (items.length === 0) return null;

  const handlePlaceBet = () => {
    setBetError("");
    if (!user) { setBetError("Please log in to place a bet"); return; }
    const stakeVal = parseFloat(stake);
    if (!stakeVal || stakeVal <= 0) { setBetError("Enter a valid stake"); return; }
    if (stakeVal > user.balance) { setBetError("Insufficient balance"); return; }

    updateBalance(-stakeVal);
    addBet({
      userId: user.id,
      selections: items.map(i => ({ match: i.match, selection: i.selection, odds: i.odds })),
      stake: stakeVal,
      totalOdds,
      potentialWin: parseFloat(potentialWin),
      status: "pending",
    });
    setBetPlaced(true);
    setStake("");
    setTimeout(() => { setBetPlaced(false); onClear(); }, 2000);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 md:right-auto md:left-auto md:bottom-4 md:right-4 md:w-96 z-40">
      <motion.div
        layout
        className="bg-card border border-border rounded-t-2xl md:rounded-2xl shadow-card overflow-hidden"
      >
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 gradient-bet text-primary-foreground"
        >
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold">Bet Slip</span>
            <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center">
              {items.length}
            </span>
          </div>
          {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-3 max-h-60 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.matchId} className="flex items-start justify-between bg-muted rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{item.match}</p>
                      <p className="font-semibold text-sm text-foreground">{item.selection}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="font-heading font-bold text-accent text-sm">{item.odds.toFixed(2)}</span>
                      <button onClick={() => onRemove(item.matchId)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 pb-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Odds</span>
                  <span className="font-heading font-bold text-accent">{totalOdds.toFixed(2)}</span>
                </div>

                <Input
                  type="number"
                  placeholder="Enter stake (KES)"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  className="font-medium"
                />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Potential Win</span>
                  <span className="font-heading font-bold text-secondary text-lg">KES {potentialWin}</span>
                </div>

                <Button
                  onClick={handlePlaceBet}
                  disabled={betPlaced}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-base h-12 shadow-accent"
                >
                  {betPlaced ? (
                    <><CheckCircle className="w-5 h-5 mr-2" /> Bet Placed!</>
                  ) : (
                    "Place Bet"
                  )}
                </Button>

                {betError && (
                  <p className="text-xs text-red-500 text-center">{betError}</p>
                )}

                <button
                  onClick={onClear}
                  className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Clear All
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
