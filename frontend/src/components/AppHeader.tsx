import { motion } from "framer-motion";
import { BarChart3, FileText, TrendingUp, Map, LogOut, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  username: string;
  role: string;
  isOnline: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

const getNavItems = (role: string) => {
  if (role === "admin") {
    return [
      { id: "overview", label: "Admin", icon: BarChart3 },
      { id: "analytics", label: "Analytics", icon: TrendingUp },
      { id: "mapping", label: "Mapping", icon: Map },
      { id: "assistant", label: "AI Assistant", icon: Bot },
    ];
  }

  if (role === "supervisor") {
    return [
      { id: "supervisor", label: "Supervisor", icon: BarChart3 },
      { id: "analytics", label: "Analytics", icon: TrendingUp },
      { id: "mapping", label: "Mapping", icon: Map },
      { id: "assistant", label: "AI Assistant", icon: Bot },
    ];
  }

  return [
    { id: "collect", label: "Field Work", icon: FileText },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
    { id: "mapping", label: "Mapping", icon: Map },
    { id: "assistant", label: "AI Assistant", icon: Bot },
  ];
};

export default function AppHeader({ username, role, isOnline, activeTab, onTabChange, onLogout }: AppHeaderProps) {
  const navItems = getNavItems(role);

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <BarChart3 className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground leading-none">AI Census</h1>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">v2.0</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="hidden sm:flex items-center gap-1 bg-muted rounded-lg p-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === item.id
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* Status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isOnline
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          }`}>
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-success" : "bg-destructive"}`}
            />
            {isOnline ? "Online" : "Offline"}
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-sm font-medium text-foreground leading-none">{username}</span>
              <span className="text-xs text-muted-foreground capitalize">{role}</span>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground hover:text-destructive">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
