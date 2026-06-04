import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BarChart3, Target, Bot, Smartphone, Mail, Lock, User, Building, Eye, EyeOff } from "lucide-react";

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (data: { username: string; email: string; password: string; role: string }) => Promise<void>;
}

const features = [
  { icon: Target, label: "Accurate Data Collection" },
  { icon: Bot, label: "AI-Powered Validation" },
  { icon: Smartphone, label: "Offline Support" },
];

export default function LoginForm({ onLogin, onRegister }: LoginFormProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "enumerator",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onLogin(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onRegister(formData);
      setIsRegistering(false);
      setFormData({ username: "", email: "", password: "", role: "enumerator" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-primary p-12">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md text-center"
        >
          <div className="text-6xl mb-8 animate-float">
            <BarChart3 className="w-16 h-16 mx-auto text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-primary-foreground mb-4">
            AI Census System
          </h1>
          <p className="text-lg text-primary-foreground/80 mb-10 leading-relaxed">
            Modern digital census data collection with AI-powered validation
          </p>
          <div className="space-y-4">
            {features.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.15 }}
                className="flex items-center gap-3 text-primary-foreground/90 justify-center"
              >
                <f.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{f.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-card">
        <motion.div
          key={isRegistering ? "register" : "login"}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-[420px]"
        >
          <div className="text-center mb-8">
            <div className="lg:hidden mb-4">
              <BarChart3 className="w-10 h-10 mx-auto text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {isRegistering ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isRegistering ? "Join the digital census revolution" : "Sign in to your census account"}
            </p>
          </div>

          {isRegistering ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-sm">
                  <User className="w-3.5 h-3.5 text-muted-foreground" /> Username
                </Label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Enter your username"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-sm">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email
                </Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-sm">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" /> Password
                </Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Create a strong password"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-sm">
                  <Building className="w-3.5 h-3.5 text-muted-foreground" /> Role
                </Label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="enumerator">📝 Enumerator</option>
                  <option value="supervisor">👨‍💼 Supervisor</option>
                  <option value="admin">🛡️ Administrator</option>
                </select>
              </div>
              <Button type="submit" className="w-full mt-2" disabled={isLoading}>
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setIsRegistering(false)}
              >
                Back to Login
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-sm">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-sm">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" /> Password
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full mt-2" disabled={isLoading}>
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setIsRegistering(true)}
              >
                Create New Account
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
