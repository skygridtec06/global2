import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, Navigate } from "react-router-dom";
import { User, Wallet, LogOut, Phone, Calendar, ArrowDownToLine, ArrowUpFromLine, Loader2, CheckCircle, AlertCircle, ChevronRight, Plus, Minus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initiateDeposit, pollPaymentStatus } from "@/lib/paymentService";
import { addTransaction, getUserTransactions, getUserBets, type Transaction, type BetRecord } from "@/lib/transactionStore";

const Profile = () => {
  const { user, logout, updateBalance } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw" | null>(null);
  const [amount, setAmount] = useState("");

  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"initiating" | "sent" | "success" | "failed" | "timeout" | null>(null);
  const pollCleanup = useRef<(() => void) | null>(null);
  const [historyView, setHistoryView] = useState<"deposits" | "withdrawals" | "bets" | null>(null);
  const [deposits, setDeposits] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Transaction[]>([]);
  const [bets, setBets] = useState<BetRecord[]>([]);

  // Load transaction history
  useEffect(() => {
    if (user) {
      setDeposits(getUserTransactions(user.id, "deposit"));
      setWithdrawals(getUserTransactions(user.id, "withdrawal"));
      setBets(getUserBets(user.id));
    }
  }, [user?.id, user?.balance]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollCleanup.current) pollCleanup.current(); };
  }, []);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const resetPaymentState = () => {
    if (pollCleanup.current) pollCleanup.current();
    setAmount(""); setMessage(""); setPaymentStatus(null); setIsProcessing(false);
  };

  const handleDeposit = async () => {
    if (isProcessing) return;
    const val = Number(amount);
    if (!val || val <= 0) { setMessage("Enter a valid amount"); return; }
    if (val < 1) { setMessage("Minimum deposit is KES 1"); return; }
    if (!user.phone) {
      setMessage("No phone number on your account"); return;
    }

    setIsProcessing(true);
    setPaymentStatus("initiating");
    setMessage("Connecting to M-Pesa...");

    try {
      const result = await initiateDeposit(val, user.phone, user.id);
      if (!result.success || !result.externalReference) {
        setPaymentStatus("failed");
        setMessage(`Failed: ${result.message || "Could not initiate payment"}`);
        setIsProcessing(false);
        return;
      }

      setPaymentStatus("sent");
      setMessage("📱 STK Push sent! Check your phone and enter your M-Pesa PIN...");

      pollCleanup.current = pollPaymentStatus(
        result.externalReference,
        () => {
          setPaymentStatus("success");
          updateBalance(val);
          addTransaction({ userId: user.id, type: "deposit", amount: val, phone: user.phone, status: "success", reference: result.externalReference });
          setDeposits(getUserTransactions(user.id, "deposit"));
          setMessage(`✅ Deposit of KES ${val.toLocaleString("en-KE")} received successfully!`);
          setAmount("");
          setIsProcessing(false);
          setTimeout(() => { setPaymentStatus(null); setMessage(""); setActiveTab(null); }, 4000);
        },
        () => {
          setPaymentStatus("failed");
          addTransaction({ userId: user.id, type: "deposit", amount: val, phone: user.phone, status: "failed", reference: result.externalReference });
          setDeposits(getUserTransactions(user.id, "deposit"));
          setMessage("❌ Payment failed. Please try again.");
          setIsProcessing(false);
        },
        () => {
          setPaymentStatus("timeout");
          setMessage("⏱️ Payment check timed out. If you paid, your balance will update shortly.");
          setIsProcessing(false);
        },
        3000, 100
      );
    } catch (error) {
      setPaymentStatus("failed");
      setMessage(`❌ Error: ${error instanceof Error ? error.message : "Connection failed"}`);
      setIsProcessing(false);
    }
  };

  const handleWithdraw = () => {
    const val = Number(amount);
    if (!val || val <= 0) { setMessage("Enter a valid amount"); return; }
    if (val > user.balance) { setMessage("Insufficient balance"); return; }
    updateBalance(-val);
    addTransaction({ userId: user.id, type: "withdrawal", amount: val, phone: user.phone, status: "success" });
    setWithdrawals(getUserTransactions(user.id, "withdrawal"));
    setMessage(`✅ Withdrawn KES ${val.toLocaleString("en-KE")} successfully!`);
    setAmount("");
    setTimeout(() => { setMessage(""); setActiveTab(null); }, 2000);
  };

  const getStatusColor = () => {
    if (paymentStatus === "success") return "border-green-500/30 bg-green-500/10 text-green-600";
    if (paymentStatus === "failed") return "border-red-500/30 bg-red-500/10 text-red-600";
    if (paymentStatus === "timeout") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-600";
    return "border-blue-500/30 bg-blue-500/10 text-blue-600";
  };

  const getStatusIcon = () => {
    if (paymentStatus === "initiating" || paymentStatus === "sent") return <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />;
    if (paymentStatus === "success") return <CheckCircle className="w-5 h-5 flex-shrink-0" />;
    if (paymentStatus === "failed" || paymentStatus === "timeout") return <AlertCircle className="w-5 h-5 flex-shrink-0" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8 max-w-lg">
        {/* Profile Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-heading font-bold">{user.name}</h1>
          <p className="text-muted-foreground text-sm">{user.countryCode} {user.phone}</p>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5" />
            <span className="text-sm font-medium opacity-80">Account Balance</span>
          </div>
          <p className="text-3xl font-heading font-black">
            KES {user.balance.toLocaleString("en-KE")}
          </p>
        </div>

        {/* Deposit / Withdraw Buttons */}
        <div className="flex gap-3 mb-6">
          <Button
            className={`flex-1 h-12 font-semibold text-base ${activeTab === "deposit" ? "bg-green-600 text-white hover:bg-green-700" : "bg-green-600/10 text-green-500 hover:bg-green-600/20"}`}
            onClick={() => { resetPaymentState(); setActiveTab(activeTab === "deposit" ? null : "deposit"); }}
          >
            <ArrowDownToLine className="w-5 h-5 mr-2" /> Deposit
          </Button>
          <Button
            className={`flex-1 h-12 font-semibold text-base ${activeTab === "withdraw" ? "bg-red-600 text-white hover:bg-red-700" : "bg-red-600/10 text-red-500 hover:bg-red-600/20"}`}
            onClick={() => { resetPaymentState(); setActiveTab(activeTab === "withdraw" ? null : "withdraw"); }}
          >
            <ArrowUpFromLine className="w-5 h-5 mr-2" /> Withdraw
          </Button>
        </div>

        {/* Transaction Form */}
        {activeTab && (
          <div className="bg-card rounded-xl border border-border p-5 mb-6 space-y-4">
            <h3 className="font-heading font-bold text-lg">
              {activeTab === "deposit" ? "Deposit via M-Pesa" : "Withdraw"}
            </h3>

            {/* Status Message */}
            {message && (
              <div className={`rounded-lg border p-4 text-sm ${getStatusColor()}`}>
                <div className="flex items-start gap-2">
                  {getStatusIcon()}
                  <span className="flex-1">{message}</span>
                </div>
              </div>
            )}

            {/* M-Pesa Phone Number (deposit only) */}
            {activeTab === "deposit" && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">M-Pesa Phone Number</label>
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-muted/50 border border-border">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{user.countryCode} {user.phone}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  STK Push will be sent to your registered number
                </p>
              </div>
            )}

            {/* Withdrawal phone display */}
            {activeTab === "withdraw" && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">M-Pesa Phone Number</label>
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-muted/50 border border-border">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{user.countryCode} {user.phone}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Your registered phone number</p>
              </div>
            )}

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Amount (KES)</label>
              <input
                type="number"
                min={activeTab === "deposit" ? "1" : "1"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                disabled={isProcessing}
                className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary text-base disabled:opacity-50"
              />
              {activeTab === "withdraw" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Available: KES {user.balance.toLocaleString("en-KE")}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {[100, 500, 1000, 5000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(String(preset))}
                  disabled={isProcessing}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold bg-muted/50 border border-border hover:bg-primary/10 hover:border-primary/30 transition-colors disabled:opacity-50"
                >
                  {preset.toLocaleString()}
                </button>
              ))}
            </div>
            <Button
              className={`w-full h-12 font-semibold text-base ${
                activeTab === "deposit"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
              onClick={activeTab === "deposit" ? handleDeposit : handleWithdraw}
              disabled={isProcessing || !amount}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : activeTab === "deposit" ? (
                "Deposit Now"
              ) : (
                "Withdraw Now"
              )}
            </Button>
          </div>
        )}

        {/* Account Details */}
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Full Name</span>
            </div>
            <span className="text-sm text-muted-foreground">{user.name}</span>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Phone</span>
            </div>
            <span className="text-sm text-muted-foreground">{user.countryCode} {user.phone}</span>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Joined</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            </span>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-card rounded-xl border border-border divide-y divide-border mt-6">
          <button
            onClick={() => setHistoryView(historyView === "deposits" ? null : "deposits")}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
                <Plus className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Deposit History</p>
                <p className="text-xs text-muted-foreground">View your deposits</p>
              </div>
            </div>
            <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${historyView === "deposits" ? "rotate-90" : ""}`} />
          </button>

          {historyView === "deposits" && (
            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {deposits.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No deposits yet</p>
              ) : deposits.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-semibold text-green-500">+KES {tx.amount.toLocaleString("en-KE")}</p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    tx.status === "success" ? "bg-green-500/20 text-green-500" :
                    tx.status === "failed" ? "bg-red-500/20 text-red-500" :
                    "bg-yellow-500/20 text-yellow-500"
                  }`}>{tx.status}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setHistoryView(historyView === "withdrawals" ? null : "withdrawals")}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-600/20 flex items-center justify-center">
                <Minus className="w-5 h-5 text-orange-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Withdrawal History</p>
                <p className="text-xs text-muted-foreground">View your withdrawals</p>
              </div>
            </div>
            <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${historyView === "withdrawals" ? "rotate-90" : ""}`} />
          </button>

          {historyView === "withdrawals" && (
            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {withdrawals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No withdrawals yet</p>
              ) : withdrawals.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-semibold text-red-500">-KES {tx.amount.toLocaleString("en-KE")}</p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-500/20 text-green-500">success</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setHistoryView(historyView === "bets" ? null : "bets")}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Bet History</p>
                <p className="text-xs text-muted-foreground">View your bets</p>
              </div>
            </div>
            <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${historyView === "bets" ? "rotate-90" : ""}`} />
          </button>

          {historyView === "bets" && (
            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {bets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No bets placed yet</p>
              ) : bets.map(bet => (
                <div key={bet.id} className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">KES {bet.stake.toLocaleString("en-KE")} @ {bet.totalOdds.toFixed(2)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      bet.status === "won" ? "bg-green-500/20 text-green-500" :
                      bet.status === "lost" ? "bg-red-500/20 text-red-500" :
                      "bg-yellow-500/20 text-yellow-500"
                    }`}>{bet.status}</span>
                  </div>
                  {bet.selections.map((s, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{s.match} — {s.selection} ({s.odds.toFixed(2)})</p>
                  ))}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{new Date(bet.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span>
                    <span className="text-secondary font-medium">Win: KES {bet.potentialWin.toLocaleString("en-KE")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logout */}
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full mt-6 border-red-500/30 text-red-500 hover:bg-red-500/10 h-12 font-semibold"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Logout
        </Button>
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

export default Profile;
