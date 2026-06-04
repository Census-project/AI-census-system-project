import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import LoginForm from "@/components/LoginForm";
import AppHeader from "@/components/AppHeader";
import StatsCards from "@/components/StatsCards";
import CensusForm from "@/components/CensusForm";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import MappingDashboard from "@/components/MappingDashboard";
import AIAssistant from "@/components/AIAssistant";
import AdminDashboard from "@/components/AdminDashboard";
import SupervisorDashboard from "@/components/SupervisorDashboard";
import EnumeratorDashboard from "@/components/EnumeratorDashboard";
import { api, type RegisterData } from "@/lib/api";

interface User {
  username: string;
  role: string;
}

export default function Index() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("collect");

  useEffect(() => {
    const on = () => {
      setIsOnline(true);
      syncPendingSubmissions();
    };
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  const syncPendingSubmissions = async () => {
    const token = localStorage.getItem('token');
    if (!token || !navigator.onLine) return;

    const pending = JSON.parse(localStorage.getItem('pendingSubmissions') || '[]');
    if (pending.length === 0) return;

    const synced = [];
    for (const submission of pending) {
      try {
        await api.submitCensus(submission, token);
        synced.push(submission);
      } catch (error) {
        console.error('Failed to sync submission:', error);
        break;
      }
    }

    const remaining = pending.filter((s: any) => !synced.some((syncedItem) => JSON.stringify(syncedItem) === JSON.stringify(s)));
    localStorage.setItem('pendingSubmissions', JSON.stringify(remaining));

    if (synced.length > 0) {
      alert(`Synced ${synced.length} pending submissions.`);
    }
  };

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      setUser({ username: data.user.username, role: data.user.role });
      setActiveTab(data.user.role === "admin" ? "overview" : data.user.role === "supervisor" ? "supervisor" : "collect");
      syncPendingSubmissions();
    },
    onError: (error: Error) => {
      alert(error.message);
    },
  });

  const registerMutation = useMutation({
    mutationFn: api.register,
    onSuccess: () => {
      alert("Registration successful! Please login.");
    },
    onError: (error: Error) => {
      alert(error.message);
    },
  });

  const handleLogin = (email: string, password: string) => {
    loginMutation.mutate({ email, password });
  };

  const handleRegister = (data: RegisterData) => {
    registerMutation.mutate(data);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (!user) {
    return <LoginForm onLogin={handleLogin} onRegister={handleRegister} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.14),transparent_52%)]" />
      <AppHeader
        username={user.username}
        role={user.role}
        isOnline={isOnline}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
        >
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome back, {user.username}!</h2>
            <p className="mt-1 text-muted-foreground">
              {activeTab === "overview" && "Access the admin console to manage users, review quality, and inspect system health."}
              {activeTab === "collect" && "Capture household records quickly with a smoother field workflow."}
              {activeTab === "analytics" && "Track trends, demographic balance, and collection momentum in real time."}
              {activeTab === "mapping" && "Review spatial coverage and coordinate-tagged records across the field."}
              {activeTab === "assistant" && "Get instant help with census questions, form guidance, and data validation."}
            </p>
          </div>
          <div className="rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
            Active workspace: <span className="font-medium text-foreground capitalize">{activeTab}</span>
          </div>
        </motion.div>

        <StatsCards role={user.role} />

        {activeTab === "overview" && user.role === "admin" && <AdminDashboard />}
        {activeTab === "overview" && user.role !== "admin" && (
          <div className="flex items-center justify-center py-12">
            <Card className="glass-card-hover border-border/80 bg-card/90 max-w-md">
              <CardContent className="text-center p-8">
                <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Access Restricted</h3>
                <p className="text-sm text-muted-foreground">
                  Administrator privileges required to access this section.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
        {activeTab === "supervisor" && user.role === "supervisor" && <SupervisorDashboard />}
        {activeTab === "collect" && user.role !== "admin" && user.role !== "supervisor" && <EnumeratorDashboard />}
        {activeTab === "collect" && <CensusForm isOnline={isOnline} />}
        {activeTab === "analytics" && <AnalyticsDashboard />}
        {activeTab === "mapping" && <MappingDashboard />}
        {activeTab === "assistant" && <AIAssistant />}
      </main>
    </div>
  );
}
