import { motion } from "framer-motion";
import { Activity, BarChart3, Clock3, Database, PieChart, Signal, Users2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import NaturalLanguageQuery from "@/components/NaturalLanguageQuery";
import { useState, useEffect } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface CensusRecord {
  household_id: string;
  first_name: string;
  last_name: string;
  age: string;
  gender: string;
  phone: string;
  location_address: string;
  gps_latitude: number | null;
  gps_longitude: number | null;
  submission_type: string;
  timestamp: string;
}

const fallbackRecords: CensusRecord[] = [
  {
    household_id: "HH-2401-001",
    first_name: "Amina",
    last_name: "Bello",
    age: "29",
    gender: "F",
    phone: "+2348011111111",
    location_address: "Ikeja, Lagos",
    gps_latitude: 6.6018,
    gps_longitude: 3.3515,
    submission_type: "online",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    household_id: "HH-2401-002",
    first_name: "Tunde",
    last_name: "Adebayo",
    age: "41",
    gender: "M",
    phone: "+2348022222222",
    location_address: "Yaba, Lagos",
    gps_latitude: 6.5095,
    gps_longitude: 3.3711,
    submission_type: "offline",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    household_id: "HH-2401-003",
    first_name: "Chioma",
    last_name: "Okafor",
    age: "35",
    gender: "F",
    phone: "+2348033333333",
    location_address: "Gwarinpa, Abuja",
    gps_latitude: 9.1126,
    gps_longitude: 7.3986,
    submission_type: "online",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
  },
  {
    household_id: "HH-2401-004",
    first_name: "Musa",
    last_name: "Garba",
    age: "52",
    gender: "M",
    phone: "+2348044444444",
    location_address: "Kano Municipal, Kano",
    gps_latitude: 12.0022,
    gps_longitude: 8.5919,
    submission_type: "offline",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
  },
  {
    household_id: "HH-2401-005",
    first_name: "Zainab",
    last_name: "Sani",
    age: "24",
    gender: "F",
    phone: "+2348055555555",
    location_address: "Jos North, Plateau",
    gps_latitude: 9.8965,
    gps_longitude: 8.8583,
    submission_type: "online",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
  },
  {
    household_id: "HH-2401-006",
    first_name: "Emeka",
    last_name: "Nwosu",
    age: "31",
    gender: "M",
    phone: "+2348066666666",
    location_address: "Owerri, Imo",
    gps_latitude: 5.4833,
    gps_longitude: 7.0333,
    submission_type: "online",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
  },
];

const chartPalette = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--accent))"];

function readPendingRecords(): CensusRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem("pendingSubmissions");
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatHourLabel(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "numeric" });
}

function getAgeBand(ageValue: string) {
  const age = Number(ageValue);
  if (age <= 17) return "0-17";
  if (age <= 35) return "18-35";
  if (age <= 59) return "36-59";
  return "60+";
}

export default function AnalyticsDashboard() {
  const [insights, setInsights] = useState<string[]>(["Loading AI insights..."]);

  useEffect(() => {
    const fetchInsights = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setInsights(["Authentication required for AI insights"]);
        return;
      }

      try {
        const response = await api.getAIInsights(token);
        setInsights(response.insights);
      } catch (error) {
        console.error('Failed to fetch AI insights:', error);
        setInsights(["Failed to load AI insights. Using fallback data."]);
      }
    };

    fetchInsights();
  }, []);

  const records = [...fallbackRecords, ...readPendingRecords()].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const onlineCount = records.filter((record) => record.submission_type === "online").length;
  const offlineCount = records.filter((record) => record.submission_type !== "online").length;
  const geotaggedCount = records.filter((record) => record.gps_latitude && record.gps_longitude).length;
  const averageAge = Math.round(records.reduce((sum, record) => sum + Number(record.age || 0), 0) / records.length);

  const submissionsByLocation = Object.entries(
    records.reduce<Record<string, number>>((acc, record) => {
      const label = record.location_address.split(",")[0]?.trim() || "Unknown";
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .slice(0, 6);

  const genderBreakdown = Object.entries(
    records.reduce<Record<string, number>>((acc, record) => {
      const key = record.gender || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const ageBands = ["0-17", "18-35", "36-59", "60+"];
  const ageDistribution = ageBands.map((band) => ({
    name: band,
    value: records.filter((record) => getAgeBand(record.age) === band).length,
  }));

  const recentTrend = [...records]
    .slice(0, 8)
    .reverse()
    .map((record) => ({
      time: record.timestamp,
      entries: 1,
      label: formatHourLabel(record.timestamp),
    }));

  const statCards = [
    {
      title: "Total records",
      value: records.length,
      meta: "Live dashboard snapshot",
      icon: Database,
    },
    {
      title: "Average age",
      value: averageAge,
      meta: "Across all captured residents",
      icon: Users2,
    },
    {
      title: "Geo-tagged",
      value: `${Math.round((geotaggedCount / records.length) * 100)}%`,
      meta: `${geotaggedCount} records with coordinates`,
      icon: Signal,
    },
    {
      title: "Offline queue",
      value: offlineCount,
      meta: `${onlineCount} synced online`,
      icon: Clock3,
    },
  ];

  return (
    <section className="space-y-6" aria-labelledby="analytics-heading">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        whileHover={{ y: -4, scale: 1.01, rotateX: 2, rotateY: -2 }}
        className="cinematic-panel relative overflow-hidden rounded-[24px] p-6"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Field Intelligence</p>
            <h3 id="analytics-heading" className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Census analytics dashboard
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Monitor submission volume, demographic patterns, and collection coverage in one smooth operational view.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Updated from local census activity
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 xl:grid-cols-[1.8fr_1.2fr]">
        <Card className="glass-card-hover border-border/80 bg-card/90">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">AI Insights</p>
                <h4 className="mt-2 text-xl font-semibold text-foreground">Predicted field intelligence</h4>
              </div>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              {insights.map((insight, index) => (
                <p key={index} className="rounded-2xl bg-muted p-3 text-foreground/90">
                  {insight}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <NaturalLanguageQuery records={records} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            whileHover={{ y: -5, scale: 1.01, rotateX: 3, rotateY: -3 }}
          >
            <Card className="cinematic-panel border-border/80 bg-card/90">
              <CardContent className="flex items-start justify-between p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{card.title}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{card.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{card.meta}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <card.icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.35 }}>
          <Card className="glass-card h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BarChart3 className="h-5 w-5 text-primary" />
                Submission hotspots
              </CardTitle>
              <CardDescription>Top areas by captured household count.</CardDescription>
            </CardHeader>
            <CardContent className="h-[310px] pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={submissionsByLocation} barCategoryGap={18}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.45)" }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 14,
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.35 }}>
          <Card className="glass-card h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <PieChart className="h-5 w-5 text-primary" />
                Gender split
              </CardTitle>
              <CardDescription>Population balance from recent submissions.</CardDescription>
            </CardHeader>
            <CardContent className="h-[310px] pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 14,
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Pie data={genderBreakdown} dataKey="value" nameKey="name" innerRadius={70} outerRadius={108} paddingAngle={3}>
                    {genderBreakdown.map((entry, index) => (
                      <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                    ))}
                  </Pie>
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="mt-4 flex flex-wrap gap-3">
                {genderBreakdown.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
                    {item.name}: <span className="font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.35fr]">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.35 }}>
          <Card className="glass-card h-full">
            <CardHeader>
              <CardTitle className="text-xl">Age distribution</CardTitle>
              <CardDescription>Quick demographic segmentation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ageDistribution.map((band, index) => {
                const percent = Math.max(8, Math.round((band.value / records.length) * 100));
                return (
                  <div key={band.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{band.name}</span>
                      <span className="text-muted-foreground">{band.value} people</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ delay: 0.28 + index * 0.06, duration: 0.45 }}
                        className="h-full rounded-full bg-primary"
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.35 }}>
          <Card className="glass-card h-full">
            <CardHeader>
              <CardTitle className="text-xl">Recent collection pulse</CardTitle>
              <CardDescription>Latest field activity arranged chronologically.</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recentTrend}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis hide domain={[0, 1.8]} />
                  <Tooltip
                    labelFormatter={(_, payload) => {
                      const raw = payload?.[0]?.payload?.time;
                      return raw ? new Date(raw).toLocaleString() : "";
                    }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 14,
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar dataKey="entries" radius={[12, 12, 0, 0]} fill="hsl(var(--success))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
