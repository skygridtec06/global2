// Local storage based transaction history

export interface Transaction {
  id: string;
  userId: string;
  type: "deposit" | "withdrawal";
  amount: number;
  phone: string;
  status: "success" | "failed" | "pending";
  reference?: string;
  createdAt: string;
}

export interface BetRecord {
  id: string;
  userId: string;
  selections: { match: string; selection: string; odds: number }[];
  stake: number;
  totalOdds: number;
  potentialWin: number;
  status: "pending" | "won" | "lost";
  createdAt: string;
}

const TX_KEY = "globalbet_transactions";
const BET_KEY = "globalbet_bets";

function getTransactions(): Transaction[] {
  try {
    return JSON.parse(localStorage.getItem(TX_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveTx(txs: Transaction[]) {
  localStorage.setItem(TX_KEY, JSON.stringify(txs));
}

function getBets(): BetRecord[] {
  try {
    return JSON.parse(localStorage.getItem(BET_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveBets(bets: BetRecord[]) {
  localStorage.setItem(BET_KEY, JSON.stringify(bets));
}

export function addTransaction(tx: Omit<Transaction, "id" | "createdAt">): Transaction {
  const full: Transaction = {
    ...tx,
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  const all = getTransactions();
  all.unshift(full);
  saveTx(all);
  return full;
}

export function getUserTransactions(userId: string, type?: "deposit" | "withdrawal"): Transaction[] {
  const all = getTransactions();
  return all.filter(t => t.userId === userId && (!type || t.type === type));
}

export function addBet(bet: Omit<BetRecord, "id" | "createdAt">): BetRecord {
  const full: BetRecord = {
    ...bet,
    id: `bet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  const all = getBets();
  all.unshift(full);
  saveBets(all);
  return full;
}

export function getUserBets(userId: string): BetRecord[] {
  return getBets().filter(b => b.userId === userId);
}
