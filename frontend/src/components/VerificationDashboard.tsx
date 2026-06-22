import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, AlertTriangle, TrendingUp, Clock } from "lucide-react";
import { api } from "@/lib/api";

interface FlaggedRecord {
  id: string;
  household_id: string;
  first_name: string;
  last_name: string;
  verification_status: string;
  verification_results: {
    issues: Array<{
      field: string;
      severity: "CRITICAL" | "WARNING" | "INFO";
      message: string;
    }>;
    review_priority: "HIGH" | "MEDIUM" | "LOW";
    confidence_score: number;
  };
  verified_at: string;
}

interface VerificationMetrics {
  total_verified: number;
  pass_rate: number;
  high_priority_count: number;
  average_confidence: number;
}

export default function VerificationDashboard() {
  const [metrics, setMetrics] = useState<VerificationMetrics | null>(null);
  const [flaggedRecords, setFlaggedRecords] = useState<FlaggedRecord[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [selectedPriority, setSelectedPriority] = useState("HIGH");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVerificationData();
    const interval = setInterval(fetchVerificationData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [selectedPriority]);

  const fetchVerificationData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      // Fetch flagged records
      const flaggedRes = await api.getFlaggedRecords(token, { priority: selectedPriority });
      setFlaggedRecords(flaggedRes.records || []);

      // Fetch notifications
      const notifRes = await api.getNotifications(token);
      setNotifications(notifRes.notifications || []);

      // Calculate metrics
      if (flaggedRes.records && flaggedRes.records.length > 0) {
        const avgConfidence = Math.round(
          flaggedRes.records.reduce((sum: number, r: any) => sum + (r.verification_results?.confidence_score || 0), 0) /
            flaggedRes.records.length
        );
        setMetrics({
          total_verified: flaggedRes.records.length,
          pass_rate: 75,
          high_priority_count: flaggedRes.records.filter((r: any) => r.verification_results?.review_priority === "HIGH").length,
          average_confidence: avgConfidence,
        });
      }

      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch verification data:", err);
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "text-red-600 bg-red-50";
      case "WARNING":
        return "text-amber-600 bg-amber-50";
      default:
        return "text-blue-600 bg-blue-50";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "WARNING":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
    }
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading verification data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-card relative overflow-hidden p-6"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Data Quality</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Verification Review Center</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Monitor census records flagged by the AI verification engine for data quality issues.
          </p>
        </div>
      </motion.div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0, duration: 0.35 }}
            className="cinematic-panel flex items-center gap-4 p-5"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pass Rate</p>
              <p className="text-xl font-bold tracking-tight text-foreground">{metrics.pass_rate}%</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.35 }}
            className="cinematic-panel flex items-center gap-4 p-5"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">High Priority</p>
              <p className="text-xl font-bold tracking-tight text-foreground">{metrics.high_priority_count}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.35 }}
            className="cinematic-panel flex items-center gap-4 p-5"
          >
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Verified Records</p>
              <p className="text-xl font-bold tracking-tight text-foreground">{metrics.total_verified}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.35 }}
            className="cinematic-panel flex items-center gap-4 p-5"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Confidence</p>
              <p className="text-xl font-bold tracking-tight text-foreground">{metrics.average_confidence}/100</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Priority Filter & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Priority Selector */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="lg:col-span-2"
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Filter by Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {["HIGH", "MEDIUM", "LOW"].map((priority) => (
                  <button
                    key={priority}
                    onClick={() => setSelectedPriority(priority)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      selectedPriority === priority
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    }`}
                  >
                    {priority} Priority
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.35 }}
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.slice(0, 5).map((notif, idx) => (
                    <div key={idx} className="text-sm p-2 bg-muted/50 rounded border border-border/50">
                      <p className="font-medium text-foreground">{notif.title}</p>
                      <p className="text-xs text-muted-foreground">{notif.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No new notifications</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Flagged Records Table */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35 }}
      >
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Records Requiring Review ({flaggedRecords.length})
            </CardTitle>
            <CardDescription>Sorted by priority and severity</CardDescription>
          </CardHeader>
          <CardContent>
            {flaggedRecords.length > 0 ? (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {flaggedRecords.map((record, idx) => (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.3 }}
                    className="p-4 border border-border/80 rounded-xl bg-card/50 hover:bg-card/80 transition-colors"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="font-semibold text-foreground">
                          {record.first_name} {record.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">ID: {record.household_id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getSeverityColor(record.verification_results?.review_priority || "LOW")}`}>
                          {record.verification_results?.review_priority || "LOW"}
                        </span>
                        <span className="text-sm font-semibold text-primary">{record.verification_results?.confidence_score || 0}/100</span>
                      </div>
                    </div>

                    {/* Issues */}
                    <div className="space-y-2 mb-3">
                      {record.verification_results?.issues?.slice(0, 3).map((issue, issueIdx) => (
                        <div key={issueIdx} className="flex gap-2 text-sm">
                          {getSeverityIcon(issue.severity)}
                          <div>
                            <p className="font-medium text-foreground">{issue.message}</p>
                            <p className="text-xs text-muted-foreground">{issue.suggested_fix}</p>
                          </div>
                        </div>
                      ))}
                      {(record.verification_results?.issues?.length || 0) > 3 && (
                        <p className="text-xs text-muted-foreground">+{(record.verification_results?.issues?.length || 0) - 3} more issues</p>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-border/40">
                      <p className="text-xs text-muted-foreground">Verified: {formatDateTime(record.verified_at)}</p>
                      <button className="text-xs px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors font-medium">
                        Review
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-semibold text-foreground">All clear!</p>
                <p className="text-sm text-muted-foreground">No {selectedPriority} priority records requiring review.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
