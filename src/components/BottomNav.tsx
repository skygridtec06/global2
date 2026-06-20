import { Link, useLocation } from "react-router-dom";
import { Home, Play, FileText, ShoppingCart, User } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

interface BottomNavProps {
  betSlipCount?: number;
}

export function BottomNav({ betSlipCount = 0 }: BottomNavProps) {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    { icon: Home, label: "Home", path: "/", id: "home" },
    { icon: Play, label: "Live", path: "/live", id: "live" },
    { icon: FileText, label: "Selections", path: "/selections", id: "selections", badge: betSlipCount },
    { icon: ShoppingCart, label: "Bets", path: "/my-bets", id: "bets" },
    { icon: User, label: "Profile", path: user ? "/profile" : "/login", id: "profile" },
  ];

  const isActive = (path: string, _id: string) => {
    return location.pathname === path;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border md:hidden z-40">
      <div className="flex items-center justify-around h-16 sm:h-20">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path, item.id);

          return (
            <Link
              key={item.id}
              to={item.path}
              className="flex flex-col items-center justify-center w-full h-full relative group active:opacity-70"
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.1 }}
                className={`flex flex-col items-center justify-center gap-1 ${
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  {item.badge !== undefined && item.badge > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary text-primary-foreground text-[10px] sm:text-xs font-bold flex items-center justify-center"
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </motion.span>
                  )}
                </div>
                <span className="text-[10px] sm:text-xs font-medium">{item.label}</span>
              </motion.div>

              {active && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-10 h-1 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
