import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Selections = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-heading font-bold">My Selections</h1>
          </div>
          <p className="text-muted-foreground">Your current bet slip selections</p>
        </div>

        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-heading font-bold mb-2">No selections yet</h2>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Browse matches and tap on odds to add selections to your bet slip.
          </p>
          <Button onClick={() => navigate("/")} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Browse Matches
          </Button>
        </div>
      </main>

      <footer className="bg-foreground text-background py-8 mt-12 mb-24">
        <div className="container mx-auto px-4 text-center">
          <p className="font-heading font-bold text-xl mb-2">
            Global<span className="text-primary">Bet</span>
          </p>
          <p className="text-sm text-background/60">© 2026 GlobalBet. Bet responsibly. 18+ only.</p>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
};

export default Selections;
