import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottomNav } from "@/components/BottomNav";
import { Eye, EyeOff, Phone } from "lucide-react";
import { countries } from "@/lib/mockData";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to profile
  if (user) {
    return <Navigate to="/profile" replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!phone.trim() || !password.trim()) {
      setError("Please enter phone number and password");
      return;
    }

    setLoading(true);
    // Normalize phone: remove spaces, prepend 0 if needed
    const normalizedPhone = phone.replace(/\s/g, "").replace(/^0/, "0");
    const fullPhone = normalizedPhone.startsWith("0") ? normalizedPhone : `0${normalizedPhone}`;
    
    const result = login(fullPhone, password);
    setLoading(false);

    if (result.success) {
      navigate("/");
    } else {
      setError(result.error || "Login failed");
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-card rounded-2xl p-8 shadow-card"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="font-heading font-black text-2xl text-foreground">
              Global<span className="text-accent">Bet</span>
            </h1>
          </Link>
          <p className="text-muted-foreground mt-2">Welcome back! Login to continue.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Country Selector */}
          <div>
            <Label className="text-sm font-medium">Country</Label>
            <select
              value={selectedCountry.code}
              onChange={(e) => setSelectedCountry(countries.find((c) => c.code === e.target.value) || countries[0])}
              className="w-full mt-1 h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.prefix})</option>
              ))}
            </select>
          </div>

          {/* Phone */}
          <div>
            <Label className="text-sm font-medium">Phone Number</Label>
            <div className="flex gap-2 mt-1">
              <div className="flex items-center gap-1 px-3 h-10 rounded-lg bg-muted text-sm font-medium shrink-0">
                <Phone className="w-4 h-4" />
                {selectedCountry.prefix}
              </div>
              <Input
                placeholder="0700000000"
                className="flex-1"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <Label className="text-sm font-medium">Password</Label>
            <div className="relative mt-1">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}

          {/* Test credentials hint */}
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Test Account:</p>
            <p>Phone: <span className="font-mono">0700000000</span></p>
            <p>Password: <span className="font-mono">test1234</span></p>
            <p>Balance: <span className="font-semibold text-primary">KES 100,000</span></p>
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-12 text-base shadow-accent">
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            Sign up
          </Link>
        </p>
      </motion.div>

      {/* Bottom Navigation */}
      <BottomNav betSlipCount={0} />
    </div>
  );
};

export default Login;
