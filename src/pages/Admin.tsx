import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, Receipt, Trophy, Settings, BarChart3, Home,
  ChevronLeft, ChevronRight, Search, MoreHorizontal,
  TrendingUp, DollarSign, Gamepad2, UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { mockUsers, mockTransactions, mockMatches } from "@/lib/mockData";

type Tab = "overview" | "users" | "bets" | "transactions" | "games" | "settings";

const sidebarItems: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "users", label: "Users", icon: Users },
  { key: "bets", label: "Bets", icon: Trophy },
  { key: "transactions", label: "Transactions", icon: Receipt },
  { key: "games", label: "Games", icon: Gamepad2 },
  { key: "settings", label: "Settings", icon: Settings },
];

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) => (
  <div className="bg-card rounded-xl border border-border p-5">
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm text-muted-foreground font-medium">{label}</span>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <p className="font-heading font-bold text-2xl text-foreground">{value}</p>
  </div>
);

const Admin = () => {
  const [tab, setTab] = useState<Tab>("overview");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <div className="min-h-screen bg-background flex mb-24 md:mb-0">
      {/* Sidebar */}
      <aside className={`bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-200 ${collapsed ? "w-16" : "w-64"} shrink-0`}>
        <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
          {!collapsed && (
            <Link to="/" className="font-heading font-bold text-lg">
              Global<span className="text-accent">Bet</span>
            </Link>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="text-sidebar-foreground/60 hover:text-sidebar-foreground">
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === item.key
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-2 border-t border-sidebar-border">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent transition-colors"
          >
            <Home className="w-5 h-5" />
            {!collapsed && <span>Back to Site</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center justify-between">
          <h1 className="font-heading font-bold text-xl capitalize">{tab}</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-9 w-64" />
            </div>
          </div>
        </header>

        <div className="p-6">
          {tab === "overview" && <OverviewTab />}
          {tab === "users" && <UsersTab />}
          {tab === "transactions" && <TransactionsTab />}
          {tab === "games" && <GamesTab />}
          {tab === "bets" && <BetsTab />}
          {tab === "settings" && <SettingsTab />}
        </div>
      </main>
    </div>

    {/* Bottom Navigation */}
    <BottomNav betSlipCount={0} />
    </>
  );
};

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value="1,234" icon={UserCheck} color="bg-primary/10 text-primary" />
        <StatCard label="Active Bets" value="456" icon={Trophy} color="bg-secondary/10 text-secondary" />
        <StatCard label="Revenue (Today)" value="KES 89,400" icon={DollarSign} color="bg-accent/10 text-accent" />
        <StatCard label="Live Matches" value="3" icon={TrendingUp} color="bg-live/10 text-live" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-heading font-bold mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {mockTransactions.slice(0, 4).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.user}</p>
                  <p className="text-xs text-muted-foreground capitalize">{t.type} • {t.method}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${t.type === "deposit" || t.type === "winning" ? "text-secondary" : "text-foreground"}`}>
                    {t.type === "withdrawal" ? "-" : "+"}KES {t.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-heading font-bold mb-4">Top Users</h3>
          <div className="space-y-3">
            {mockUsers.slice(0, 4).map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.country} • {u.bets} bets</p>
                </div>
                <p className="text-sm font-bold text-accent">KES {u.balance.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            {["Name", "Email", "Country", "Balance", "Bets", "Status", ""].map((h) => (
              <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mockUsers.map((u) => (
            <tr key={u.id} className="border-t border-border hover:bg-muted/50 transition-colors">
              <td className="px-4 py-3 text-sm font-medium">{u.name}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
              <td className="px-4 py-3 text-sm">{u.country}</td>
              <td className="px-4 py-3 text-sm font-semibold">KES {u.balance.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm">{u.bets}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                  u.status === "active" ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive"
                }`}>
                  {u.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <button className="text-muted-foreground hover:text-foreground"><MoreHorizontal className="w-4 h-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransactionsTab() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            {["User", "Type", "Amount", "Method", "Status", "Date"].map((h) => (
              <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mockTransactions.map((t) => (
            <tr key={t.id} className="border-t border-border hover:bg-muted/50 transition-colors">
              <td className="px-4 py-3 text-sm font-medium">{t.user}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                  t.type === "deposit" ? "bg-secondary/10 text-secondary" :
                  t.type === "withdrawal" ? "bg-accent/10 text-accent" :
                  t.type === "winning" ? "bg-primary/10 text-primary" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {t.type}
                </span>
              </td>
              <td className="px-4 py-3 text-sm font-semibold">KES {t.amount.toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{t.method}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                  t.status === "completed" ? "bg-secondary/10 text-secondary" : "bg-accent/10 text-accent"
                }`}>
                  {t.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{t.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GamesTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-lg">Manage Matches</h2>
        <Button className="bg-primary text-primary-foreground">+ Add Match</Button>
      </div>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              {["Match", "League", "Status", "Odds (1/X/2)", ""].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockMatches.map((m) => (
              <tr key={m.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium">{m.homeTeam} vs {m.awayTeam}</td>
                <td className="px-4 py-3 text-sm">{m.league}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                    m.status === "live" ? "bg-live/10 text-live" : "bg-muted text-muted-foreground"
                  }`}>
                    {m.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-mono">
                  {m.odds.home} / {m.odds.draw} / {m.odds.away}
                </td>
                <td className="px-4 py-3">
                  <Button variant="outline" size="sm">Edit</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BetsTab() {
  return (
    <div className="bg-card rounded-xl border border-border p-8 text-center">
      <Trophy className="w-12 h-12 mx-auto text-accent mb-4" />
      <h3 className="font-heading font-bold text-lg mb-2">Bets Management</h3>
      <p className="text-muted-foreground">Connect to Lovable Cloud to manage real bets, track outcomes, and process winnings.</p>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-heading font-bold">General Settings</h3>
        <div>
          <label className="text-sm font-medium text-foreground">Site Name</label>
          <Input defaultValue="GlobalBet" className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">API Football Key</label>
          <Input placeholder="Enter your API-Football key" className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">M-Pesa Consumer Key</label>
          <Input placeholder="Enter M-Pesa key" className="mt-1" />
        </div>
        <Button className="bg-primary text-primary-foreground">Save Settings</Button>
      </div>
    </div>
  );
}

export default Admin;
