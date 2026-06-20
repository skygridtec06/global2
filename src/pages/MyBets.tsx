import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Ticket } from "lucide-react";

const MyBets = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Ticket className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-heading font-bold">My Bets</h1>
          </div>
          <p className="text-muted-foreground">Track your placed bets and winnings</p>
        </div>

        {/* Empty State */}
        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Ticket className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-heading font-bold mb-2">No bets placed yet</h2>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            You haven't placed any bets yet. Head back to the matches and add some bets to your slip!
          </p>
          <Button onClick={() => navigate("/")} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Matches
          </Button>
        </div>

        {/* Placeholder Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="text-4xl font-bold text-accent mb-2">KES 0.00</div>
            <p className="text-sm text-muted-foreground">Total Staked</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="text-4xl font-bold text-secondary mb-2">KES 0.00</div>
            <p className="text-sm text-muted-foreground">Total Winnings</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="text-4xl font-bold text-accent mb-2">0%</div>
            <p className="text-sm text-muted-foreground">Win Rate</p>
          </div>
        </div>
      </main>

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
      <BottomNav betSlipCount={0} />
    </div>
  );
};

export default MyBets;
