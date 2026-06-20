import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottomNav } from "@/components/BottomNav";
import { Eye, EyeOff, Phone, UserPlus } from "lucide-react";
import { countries } from "@/lib/mockData";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register, user } = useAuth();
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/profile" replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !phone.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const normalizedPhone = phone.replace(/\s/g, "");
    const fullPhone = normalizedPhone.startsWith("0") ? normalizedPhone : `0${normalizedPhone}`;

    const result = register(name.trim(), fullPhone, selectedCountry.prefix, password);
    setLoading(false);

    if (result.success) {
      navigate("/");
    } else {
      setError(result.error || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-card rounded-2xl p-8 shadow-card"
      >
        <div className="text-center mb-6">
          <Link to="/" className="inline-block">
            <h1 className="font-heading font-black text-2xl text-foreground">
              Global<span className="text-accent">Bet</span>
            </h1>
          </Link>
          <p className="text-muted-foreground mt-2">Create your account & start winning!</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label className="text-sm font-medium">Full Name</Label>
            <Input className="mt-1" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

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

          <div>
            <Label className="text-sm font-medium">Phone Number</Label>
            <div className="flex gap-2 mt-1">
              <div className="flex items-center gap-1 px-3 h-10 rounded-lg bg-muted text-sm font-medium shrink-0">
                <Phone className="w-4 h-4" />
                {selectedCountry.prefix}
              </div>
              <Input placeholder="0712345678" className="flex-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Password</Label>
            <div className="relative mt-1">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Create a password (min 6 chars)"
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

          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-12 text-base">
            <UserPlus className="w-5 h-5 mr-2" />
            {loading ? "Creating Account..." : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Login
          </Link>
        </p>
      </motion.div>

      {/* Bottom Navigation */}
      <BottomNav betSlipCount={0} />
    </div>
  );
};

export default Register;
