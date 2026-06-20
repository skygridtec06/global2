import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface User {
  id: string;
  name: string;
  phone: string;
  countryCode: string;
  balance: number;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  login: (phone: string, password: string) => { success: boolean; error?: string };
  register: (name: string, phone: string, countryCode: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  updateBalance: (amount: number) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USERS_KEY = "globalbet_users";
const SESSION_KEY = "globalbet_session";

function getStoredUsers(): Array<User & { password: string }> {
  try {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: Array<User & { password: string }>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession(): User | null {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function saveSession(user: User | null) {
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

// Seed test user on first load
function seedTestUser() {
  const users = getStoredUsers();
  const testPhone = "0700000000";
  if (!users.find(u => u.phone === testPhone)) {
    users.push({
      id: "test-001",
      name: "Test User",
      phone: testPhone,
      countryCode: "+254",
      balance: 100000,
      password: "test1234",
      createdAt: new Date().toISOString(),
    });
    saveUsers(users);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    seedTestUser();
    const session = getSession();
    if (session) {
      // Sync balance from users store
      const users = getStoredUsers();
      const fresh = users.find(u => u.id === session.id);
      if (fresh) {
        const { password: _, ...userData } = fresh;
        setUser(userData);
      } else {
        setUser(session);
      }
    }
  }, []);

  const login = (phone: string, password: string) => {
    const users = getStoredUsers();
    const found = users.find(u => u.phone === phone && u.password === password);
    if (!found) return { success: false, error: "Invalid phone number or password" };
    const { password: _, ...userData } = found;
    setUser(userData);
    saveSession(userData);
    return { success: true };
  };

  const register = (name: string, phone: string, countryCode: string, password: string) => {
    const users = getStoredUsers();
    if (users.find(u => u.phone === phone)) {
      return { success: false, error: "Phone number already registered" };
    }
    const newUser = {
      id: `user-${Date.now()}`,
      name,
      phone,
      countryCode,
      balance: 0,
      password,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    saveUsers(users);
    const { password: _, ...userData } = newUser;
    setUser(userData);
    saveSession(userData);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    saveSession(null);
  };

  const updateBalance = (amount: number) => {
    if (!user) return;
    const users = getStoredUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      users[idx].balance += amount;
      saveUsers(users);
      const updated = { ...user, balance: users[idx].balance };
      setUser(updated);
      saveSession(updated);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateBalance }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
