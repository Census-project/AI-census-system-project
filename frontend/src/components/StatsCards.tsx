import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, CheckCircle2, Target, Clock3, MapPin } from "lucide-react";
import { api } from "@/lib/api";

interface StatsCardsProps {
  role?: string;
}

function resolveStateFromAddress(address: string | null | undefined) {
  if (!address) return "Unknown";
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : address;
}

export default function StatsCards({ role = "enumerator" }: StatsCardsProps) {
  const [loading, setLoading] = useState(true);
  const [primaryValue, setPrimaryValue] = useState<string>("0");
  const [secondaryValue, setSecondaryValue] = useState<string>("0");
  const [coverageValue, setCoverageValue] = useState<string>("0");
  const [accuracyValue, setAccuracyValue] = useState<string>("N/A");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        if (role === "admin") {
          const stats = await api.getSystemStats(token);
          const { data } = await api.getCensusRecords(token, { limit: 1000 });
          setPrimaryValue(String(stats.totalUsers));
          setSecondaryValue(String(stats.offlineRecords));
          setAccuracyValue(stats.totalRecords > 0 ? `${Math.round((stats.onlineRecords / stats.totalRecords) * 100)}%` : "N/A");
          const stateSet = new Set(data.map((record: any) => resolveStateFromAddress(record.location_address)));
          setCoverageValue(String(stateSet.size));
        } else {
          const result = await api.getCensusRecords(token, { limit: 1000 });
          const records = result.data as any[];
          const total = result.pagination?.total ?? records.length;
          const pending = records.filter((record) => record.submission_type !== "online").length;
          const geotagged = records.filter((record) => record.location_address).length;
          const stateSet = new Set(records.map((record) => resolveStateFromAddress(record.location_address)));

          setPrimaryValue(String(total));
          setSecondaryValue(String(pending));
          setAccuracyValue(total > 0 ? `${Math.round((geotagged / total) * 100)}%` : "N/A");
          setCoverageValue(String(stateSet.size));
        }
      } catch (error) {
        console.error("Failed to load dashboard statistics:", error);
        setPrimaryValue("0");
        setSecondaryValue("0");
        setCoverageValue("0");
        setAccuracyValue("N/A");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [role]);

  const stats = role === "admin"
    ? [
        { label: "Active Users", value: loading ? "..." : primaryValue, icon: BarChart3 },
        { label: "Pending Offline", value: loading ? "..." : secondaryValue, icon: CheckCircle2 },
        { label: "Data Accuracy", value: loading ? "..." : accuracyValue, icon: Target },
        { label: "Coverage Zones", value: loading ? "..." : coverageValue, icon: MapPin },
      ]
    : [
        { label: "Total Entries", value: loading ? "..." : primaryValue, icon: BarChart3 },
        { label: "Pending Sync", value: loading ? "..." : secondaryValue, icon: Clock3 },
        { label: "Geo Coverage", value: loading ? "..." : accuracyValue, icon: Target },
        { label: "State Zones", value: loading ? "..." : coverageValue, icon: MapPin },
      ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.35 }}
          className="glass-card-hover flex items-center gap-4 p-5"
        >
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-primary">
            <stat.icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            <p className="text-xl font-bold tracking-tight text-foreground">{stat.value}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
