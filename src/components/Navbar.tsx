import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, User, Wallet, LogOut, ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { initiateDeposit, pollPaymentStatus } from "@/lib/paymentService";

const navLinks = [
  { label: "Live", path: "/live" },
  { label: "Upcoming", path: "/upcoming" },
  { label: "My Bets", path: "/my-bets" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarAction, setSidebarAction] = useState<"deposit" | "withdraw" | null>(null);
  const [sidebarAmount, setSidebarAmount] = useState("");

  const [sidebarMsg, setSidebarMsg] = useState("");
  const [sidebarProcessing, setSidebarProcessing] = useState(false);
  const location = useLocation();
  const { user, logout, updateBalance } = useAuth();
  const pollCleanup = useRef<(() => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (pollCleanup.current) pollCleanup.current(); };
  }, []);

  const resetSidebar = () => {
    if (pollCleanup.current) pollCleanup.current();
    setSidebarAmount(""); setSidebarMsg(""); setSidebarProcessing(false);
  };

  const handleSidebarDeposit = async () => {
    if (sidebarProcessing) return;
    const amount = Number(sidebarAmount);
    if (!amount || amount <= 0) { setSidebarMsg("Enter a valid amount"); return; }
    if (!user?.phone) {
      setSidebarMsg("No phone on account"); return;
    }

    setSidebarProcessing(true);
    setSidebarMsg("Connecting to M-Pesa...");

    try {
      const result = await initiateDeposit(amount, user?.phone || "", user?.id || "");
      if (!result.success || !result.externalReference) {
        setSidebarMsg(`Failed: ${result.message || "Could not initiate"}`);
        setSidebarProcessing(false);
        return;
      }

      setSidebarMsg("📱 STK Push sent! Enter your M-Pesa PIN...");

      pollCleanup.current = pollPaymentStatus(
        result.externalReference,
        () => {
          updateBalance(amount);
          setSidebarMsg(`✅ KES ${amount.toLocaleString("en-KE")} deposited!`);
          setSidebarAmount("");
          setSidebarProcessing(false);
          setTimeout(() => { setSidebarMsg(""); setSidebarAction(null); }, 3000);
        },
        () => { setSidebarMsg("❌ Payment failed"); setSidebarProcessing(false); },
        () => { setSidebarMsg("⏱️ Timed out. Balance will update if paid."); setSidebarProcessing(false); },
        3000, 100
      );
    } catch {
      setSidebarMsg("❌ Connection failed");
      setSidebarProcessing(false);
    }
  };

  const handleSidebarWithdraw = () => {
    const amount = Number(sidebarAmount);
    if (!amount || amount <= 0) { setSidebarMsg("Enter a valid amount"); return; }
    if (user && amount > user.balance) { setSidebarMsg("Insufficient balance"); return; }
    updateBalance(-amount);
    setSidebarMsg(`✅ Withdrawn KES ${amount.toLocaleString("en-KE")}`);
    setSidebarAmount("");
    setTimeout(() => { setSidebarMsg(""); setSidebarAction(null); }, 1500);
  };

  const formatBalance = (bal: number) => {
    return bal.toLocaleString("en-KE");
  };

  return (
    <nav className="sticky top-0 z-50 gradient-bet border-b border-primary/20">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center font-heading font-black text-accent-foreground text-lg">
            G
          </div>
          <span className="font-heading font-bold text-xl text-primary-foreground tracking-tight">
            Global<span className="text-accent">Bet</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`px-4 py-2 rounded-lg font-medium text-sm active:scale-95 relative ${
                location.pathname === link.path
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-primary-foreground/30 text-primary-foreground text-sm font-semibold">
                <Wallet className="w-4 h-4 mr-1" />
                KES {formatBalance(user.balance)}
              </div>
              <Link to="/profile">
                <Button size="sm" className="bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 font-semibold">
                  <User className="w-4 h-4 mr-1" />
                  {user.name.split(" ")[0]}
                </Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={logout} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button size="sm" className="bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 font-semibold">
                  <User className="w-4 h-4 mr-1" />
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                  Join Now
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile: Balance + Toggle */}
        <div className="flex md:hidden items-center gap-2">
          {user && (
            <Link to="/profile" className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-foreground/10 text-primary-foreground text-xs font-semibold">
              <Wallet className="w-3.5 h-3.5" />
              <span>KES {formatBalance(user.balance)}</span>
            </Link>
          )}
          <button
            className="text-primary-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden gradient-bet border-t border-primary-foreground/10"
          >
            <div className="p-4 space-y-2">
              {user && (
                <>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-primary-foreground/10 mb-2">
                    <Wallet className="w-4 h-4 text-primary-foreground" />
                    <span className="text-primary-foreground font-semibold text-sm">KES {formatBalance(user.balance)}</span>
                    <span className="text-primary-foreground/60 text-xs ml-auto">{user.name}</span>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 text-white hover:bg-green-700 font-semibold"
                      onClick={() => { resetSidebar(); setSidebarAction(sidebarAction === "deposit" ? null : "deposit"); }}
                    >
                      <ArrowDownToLine className="w-4 h-4 mr-1" /> Deposit
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-red-600 text-white hover:bg-red-700 font-semibold"
                      onClick={() => { resetSidebar(); setSidebarAction(sidebarAction === "withdraw" ? null : "withdraw"); }}
                    >
                      <ArrowUpFromLine className="w-4 h-4 mr-1" /> Withdraw
                    </Button>
                  </div>
                  <AnimatePresence>
                    {sidebarAction && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-2"
                      >
                        <div className="p-3 rounded-lg bg-primary-foreground/5 border border-primary-foreground/10 space-y-2">
                          {/* M-Pesa phone for deposit */}
                          {sidebarAction === "deposit" && (
                            <>
                              <p className="text-xs text-primary-foreground/70 font-medium">M-Pesa Phone Number</p>
                              <div className="px-3 py-2 rounded-lg bg-primary-foreground/10 text-primary-foreground text-sm font-medium">
                                {user.countryCode} {user.phone}
                              </div>
                            </>
                          )}
                          <p className="text-xs text-primary-foreground/70 font-medium">Amount (KES)</p>
                          <input
                            type="number"
                            min="1"
                            value={sidebarAmount}
                            onChange={(e) => setSidebarAmount(e.target.value)}
                            placeholder="Enter amount"
                            disabled={sidebarProcessing}
                            className="w-full px-3 py-2 rounded-lg bg-primary-foreground/10 text-primary-foreground text-sm placeholder:text-primary-foreground/40 outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                          />
                          <Button
                            size="sm"
                            className={`w-full font-semibold ${sidebarAction === "deposit" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}`}
                            onClick={sidebarAction === "deposit" ? handleSidebarDeposit : handleSidebarWithdraw}
                            disabled={sidebarProcessing || !sidebarAmount}
                          >
                            {sidebarProcessing ? (
                              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Processing...</>
                            ) : sidebarAction === "deposit" ? (
                              "Deposit Now"
                            ) : (
                              "Withdraw Now"
                            )}
                          </Button>
                          {sidebarMsg && <p className="text-xs text-center text-accent font-medium">{sidebarMsg}</p>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 rounded-lg text-primary-foreground/80 hover:bg-primary-foreground/10 font-medium"
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex gap-2 pt-2">
                {user ? (
                  <>
                    <Link to="/profile" className="flex-1" onClick={() => setMobileOpen(false)}>
                      <Button className="w-full bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30">Profile</Button>
                    </Link>
                    <Button className="flex-1 bg-red-500/20 text-red-300 hover:bg-red-500/30" onClick={() => { logout(); setMobileOpen(false); }}>Logout</Button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="flex-1" onClick={() => setMobileOpen(false)}>
                      <Button className="w-full bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30">Login</Button>
                    </Link>
                    <Link to="/register" className="flex-1" onClick={() => setMobileOpen(false)}>
                      <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">Join Now</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
