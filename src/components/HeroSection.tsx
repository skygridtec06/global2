import { motion } from "framer-motion";
import { Zap, Trophy, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden gradient-hero text-primary-foreground">
      {/* Decorative circles */}
      <div className="absolute top-10 right-10 w-64 h-64 rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-secondary/10 blur-3xl" />

      <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 text-accent text-sm font-semibold mb-4">
              <Zap className="w-4 h-4" /> Live Matches Available
            </span>
            <h1 className="text-4xl md:text-6xl font-heading font-black leading-tight mb-4">
              Bet on the
              <br />
              <span className="text-accent">Beautiful Game</span>
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/70 mb-8 max-w-lg">
              Real-time odds, instant payouts via M-Pesa, and the best football
              matches from leagues around the world.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap gap-3"
          >
            <Link to="/register">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-lg px-8 shadow-accent">
                Join Now — Get Bonus
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground bg-transparent hover:bg-primary-foreground/10 font-bold text-lg px-8">
                Login
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex gap-6 mt-10 text-sm text-primary-foreground/60"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-secondary" />
              Secure & Licensed
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-accent" />
              500+ Leagues
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-live" />
              Instant M-Pesa
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
