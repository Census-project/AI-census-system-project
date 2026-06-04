import { motion } from "framer-motion";
import { Compass, Locate, MapPinned, RadioTower, Route, Satellite } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";

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

function mapPoint(record: CensusRecord, index: number) {
  const latitude = record.gps_latitude ?? 0;
  const longitude = record.gps_longitude ?? 0;
  const left = 12 + ((longitude + 180) / 360) * 76;
  const top = 14 + ((90 - latitude) / 180) * 62;

  return {
    ...record,
    left: Math.max(8, Math.min(92, left)),
    top: Math.max(10, Math.min(86, top)),
    delay: index * 0.06,
  };
}

export default function MappingDashboard() {
  const [recommendation, setRecommendation] = useState("Loading AI mapping recommendation...");

  useEffect(() => {
    const fetchRecommendation = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setRecommendation("Authentication required for AI mapping recommendations");
        return;
      }

      try {
        const response = await api.getMappingRecommendation(token);
        setRecommendation(response.recommendation);
      } catch (error) {
        console.error('Failed to fetch mapping recommendation:', error);
        setRecommendation("Failed to load AI mapping recommendation");
      }
    };

    fetchRecommendation();
  }, []);

  const mappedRecords = [...fallbackRecords, ...readPendingRecords()]
    .filter((record) => record.gps_latitude !== null && record.gps_longitude !== null)
    .slice(0, 12)
    .map(mapPoint);

  const onlineNodes = mappedRecords.filter((record) => record.submission_type === "online").length;
  const offlineNodes = mappedRecords.length - onlineNodes;
  const northernmost = [...mappedRecords].sort((a, b) => (b.gps_latitude ?? 0) - (a.gps_latitude ?? 0))[0];

  return (
    <section className="space-y-6" aria-labelledby="mapping-heading">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-card relative overflow-hidden p-6"
      >
        <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-primary/10 to-transparent" />
        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Spatial Coverage</p>
            <h3 id="mapping-heading" className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Field mapping dashboard
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              View collection spread, live coordinate points, and territory coverage without leaving the dashboard.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground">
            <Satellite className="h-3.5 w-3.5 text-primary" />
            {mappedRecords.length} active coordinate points
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="glass-card-hover">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Locate className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Coverage points</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{mappedRecords.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success">
              <RadioTower className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Live sync mix</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{onlineNodes}/{offlineNodes}</p>
              <p className="text-sm text-muted-foreground">online vs offline nodes</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Northernmost point</p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">{northernmost?.location_address ?? "Not available"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card-hover border-border/80 bg-card/90">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">AI Recommendation</p>
              <h4 className="mt-2 text-xl font-semibold text-foreground">Mapping strategy suggestion</h4>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Route className="h-5 w-5" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{recommendation}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_0.9fr]">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.35 }}>
          <Card className="glass-card overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <MapPinned className="h-5 w-5 text-primary" />
                Coordinate canvas
              </CardTitle>
              <CardDescription>Stylized geospatial overview of submitted households.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[430px] overflow-hidden rounded-[1.5rem] border border-border bg-muted">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.12),transparent_38%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)))]" />
                <div className="absolute inset-0 opacity-40" style={{
                  backgroundImage:
                    "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
                  backgroundSize: "56px 56px",
                }} />
                <div className="absolute left-[9%] top-[16%] h-28 w-28 rounded-full border border-primary/20 bg-primary/10 blur-2xl" />
                <div className="absolute bottom-[14%] right-[12%] h-32 w-32 rounded-full border border-success/20 bg-success/10 blur-2xl" />

                <div className="absolute left-[9%] top-[8%] rounded-full border border-border bg-card/80 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
                  North-West Zone
                </div>
                <div className="absolute right-[10%] top-[18%] rounded-full border border-border bg-card/80 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
                  North-Central Zone
                </div>
                <div className="absolute bottom-[16%] left-[18%] rounded-full border border-border bg-card/80 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
                  South-West Zone
                </div>
                <div className="absolute bottom-[12%] right-[16%] rounded-full border border-border bg-card/80 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
                  South-East Zone
                </div>

                {mappedRecords.map((record) => (
                  <motion.div
                    key={`${record.household_id}-${record.timestamp}`}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.18 + record.delay, duration: 0.3 }}
                    className="absolute"
                    style={{ left: `${record.left}%`, top: `${record.top}%` }}
                  >
                    <div className="group relative -translate-x-1/2 -translate-y-1/2">
                      <div className={`absolute inset-0 rounded-full blur-md ${record.submission_type === "online" ? "bg-success/35" : "bg-warning/35"}`} />
                      <div
                        className={`relative flex h-4 w-4 items-center justify-center rounded-full border-2 border-card ${record.submission_type === "online" ? "bg-success" : "bg-warning"}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-card" />
                      </div>
                      <div className="pointer-events-none absolute left-1/2 top-6 z-10 hidden w-44 -translate-x-1/2 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur group-hover:block">
                        <p className="text-sm font-semibold text-foreground">{record.household_id}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{record.location_address}</p>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-primary">{record.submission_type}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}

                <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/85 px-4 py-3 backdrop-blur">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-success" /> Synced nodes
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-warning" /> Pending nodes
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Route className="h-3.5 w-3.5 text-primary" /> Coverage spans major collection zones
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.35 }}>
          <Card className="glass-card h-full">
            <CardHeader>
              <CardTitle className="text-xl">Recent mapped households</CardTitle>
              <CardDescription>Fast access to latest coordinate-tagged records.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mappedRecords.slice(0, 6).map((record, index) => (
                <motion.div
                  key={`${record.household_id}-${record.timestamp}`}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.05, duration: 0.28 }}
                  className="rounded-2xl border border-border bg-background/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{record.household_id}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{record.location_address}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${record.submission_type === "online" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                      {record.submission_type}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <span>Lat: {record.gps_latitude?.toFixed(4)}</span>
                    <span>Lng: {record.gps_longitude?.toFixed(4)}</span>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
