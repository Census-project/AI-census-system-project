import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useState } from "react";
import { BarChart3, FileText, TrendingUp, Map, LogOut, Bot, BellRing, Settings, DatabaseZap, ClipboardList, LayoutGrid, Sparkles, Users, PanelLeftClose, PanelLeftOpen, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { LucideIcon } from "lucide-react";

interface AppHeaderProps {
  username: string;
  role: string;
  isOnline: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  hint: string;
}

const getNavItems = (role: string): NavItem[] => {
  const baseItems: NavItem[] = [
    { id: "overview", label: role === "admin" ? "Admin" : role === "supervisor" ? "Overview" : "Home", icon: LayoutGrid, hint: "Workspace overview" },
    { id: "collect", label: "Field work", icon: FileText, hint: "Capture records" },
    { id: "analytics", label: "Analytics", icon: TrendingUp, hint: "Performance insights" },
    { id: "mapping", label: "Mapping", icon: Map, hint: "Coverage map" },
    { id: "assistant", label: "AI assistant", icon: Bot, hint: "Smart guidance" },
    { id: "reports", label: "Reports", icon: ClipboardList, hint: "Export-ready views" },
    { id: "activity", label: "Activity", icon: BellRing, hint: "Recent work" },
  ];

  if (role === "admin") {
    return [
      ...baseItems,
      { id: "users", label: "Users", icon: Users, hint: "Manage team" },
      { id: "settings", label: "Settings", icon: Settings, hint: "System preferences" },
    ];
  }

  if (role === "supervisor") {
    return [
      ...baseItems,
      { id: "settings", label: "Settings", icon: Settings, hint: "Team preferences" },
    ];
  }

  return [
    ...baseItems,
    { id: "sync", label: "Sync", icon: DatabaseZap, hint: "Offline queue" },
    { id: "settings", label: "Settings", icon: Settings, hint: "Preferences" },
  ];
};

export default function AppHeader({ username, role, isOnline, activeTab, onTabChange, onLogout }: AppHeaderProps) {
  const navItems = getNavItems(role);
  const [collapsed, setCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <aside className={`fixed inset-x-3 bottom-3 z-40 flex max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-[28px] border border-border/70 bg-card/90 p-3 shadow-2xl shadow-primary/10 backdrop-blur-xl transition-all duration-300 lg:left-4 lg:top-4 lg:bottom-4 lg:max-h-[calc(100vh-2rem)] ${collapsed ? "lg:w-[88px]" : "lg:w-72"}`}>
      <div className={`flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/80 px-3 py-3 ${collapsed ? "lg:flex-col lg:gap-2 lg:px-2 lg:py-2" : "lg:flex-col lg:items-start lg:gap-4 lg:px-4 lg:py-4"}`}>
        <div className={`flex items-center gap-3 ${collapsed ? "lg:flex-col lg:gap-2" : ""}`}>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <BarChart3 className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground">AI Census</h1>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">v2.0</p>
            </div>
          )}
        </div>

        <div className={`flex items-center gap-2 ${collapsed ? "lg:flex-col lg:gap-1" : ""}`}>
          <div className={`flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-2 py-1 ${collapsed ? "lg:px-1 lg:py-1" : ""}`}>
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            <Switch checked={isDark} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} aria-label="Toggle dark mode" />
            <Moon className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCollapsed((value) => !value)} className="h-8 w-8 rounded-full">
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
        <div className={`rounded-2xl border border-border/70 bg-background/70 p-3 ${collapsed ? "lg:hidden" : ""}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {username.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div>
                <p className="text-sm font-semibold text-foreground">{username}</p>
                <p className="text-xs capitalize text-muted-foreground">{role} workspace</p>
              </div>
            )}
          </div>
        </div>

        <nav className={`grid gap-2 ${collapsed ? "lg:gap-1" : ""}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center rounded-2xl border px-3 py-2.5 text-left transition-all ${collapsed ? "justify-center lg:px-2" : "justify-between"} ${
                  isActive
                    ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                    : "border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/60 hover:text-foreground"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <span className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
                  <span className={`rounded-xl p-2 ${isActive ? "bg-primary/15" : "bg-background/80"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {!collapsed && (
                    <span>
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="block text-xs opacity-80">{item.hint}</span>
                    </span>
                  )}
                </span>
                {!collapsed && isActive ? <Sparkles className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="rounded-2xl border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Quick actions</p>
            <p className="mt-1 text-xs">Switch between field collection, AI support, mapping, and reports without leaving your workspace.</p>
          </div>
        )}
      </div>

      <Button variant="ghost" size="sm" onClick={onLogout} className={`mt-3 shrink-0 w-full justify-start gap-2 text-muted-foreground hover:text-destructive ${collapsed ? "justify-center lg:px-2" : ""} lg:mt-4`}>
        <LogOut className="h-4 w-4" />
        {!collapsed && "Sign out"}
      </Button>
    </aside>
  );
}
