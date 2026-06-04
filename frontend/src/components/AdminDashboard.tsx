import { motion } from "framer-motion";
import { ShieldCheck, Users2, BarChart3, ClipboardList, Sparkles, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface AssignedSurvey {
  name: string;
  assigned_at: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
}

interface AdminUser extends User {
  assigned_surveys: AssignedSurvey[];
  totalRecords: number;
  onlineRecords: number;
  offlineRecords: number;
  lastSubmissionAt: string | null;
}

interface SystemStats {
  totalUsers: number;
  totalRecords: number;
  onlineRecords: number;
  offlineRecords: number;
  lastSync: string;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEnumeratorId, setSelectedEnumeratorId] = useState<number | null>(null);
  const [surveyDescription, setSurveyDescription] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);

  useEffect(() => {
    const fetchAdminData = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const [usersResponse, statsResponse] = await Promise.all([
          api.getUsers(token),
          api.getSystemStats(token)
        ]);
        setUsers(usersResponse.users);
        setStats(statsResponse);
      } catch (error) {
        console.error('Failed to fetch admin data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  const handleExportData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const blob = await api.exportData(token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'census_export.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const enumerators = users.filter((user) => user.role === 'enumerator');

  const handleAssignSurvey = async () => {
    setAssignError(null);
    if (!selectedEnumeratorId || !surveyDescription.trim()) {
      setAssignError('Please select an enumerator and enter a survey description.');
      return;
    }

    setAssignLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
      setAssignError('Missing authorization token.');
      setAssignLoading(false);
      return;
    }

    try {
      await api.assignSurvey(selectedEnumeratorId, surveyDescription, token);
      setSurveyDescription("");
      setSelectedEnumeratorId(null);
      setAssignError(null);

      const [usersResponse, statsResponse] = await Promise.all([
        api.getUsers(token),
        api.getSystemStats(token),
      ]);
      setUsers(usersResponse.users);
      setStats(statsResponse);
      alert('Survey assigned successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Assignment failed';
      setAssignError(message);
    } finally {
      setAssignLoading(false);
    }
  };

  const adminActions = [
    {
      title: "Manage users",
      description: `${users.length} registered users. View and control enumerator and supervisor access.`,
      icon: Users2,
      action: "View users",
      count: users.length,
    },
    {
      title: "Review reports",
      description: `${stats?.totalRecords || 0} total records. Run export-ready summaries and verify collection quality.`,
      icon: BarChart3,
      action: "View reports",
      count: stats?.totalRecords || 0,
    },
    {
      title: "System health",
      description: `Last sync: ${stats?.lastSync ? new Date(stats.lastSync).toLocaleString() : 'Never'}. Monitor uptime and API availability.`,
      icon: ShieldCheck,
      action: "Inspect system",
      status: "Online",
    },
    {
      title: "Export data",
      description: "Download complete census data including users and all records for backup or analysis.",
      icon: Download,
      action: "Export now",
      onClick: handleExportData,
    },
  ];

  return (
    <section className="space-y-6" aria-labelledby="admin-heading">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-card relative overflow-hidden p-6"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Administrator Workspace</p>
            <h3 id="admin-heading" className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Admin control center
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Manage users, review reporting, and keep field operations running smoothly.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Role-based admin access enabled
          </div>
        </div>
      </motion.div>

      {/* System Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card-hover">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Total Users</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {loading ? "..." : users.length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Total Records</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {loading ? "..." : stats?.totalRecords || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Offline Queue</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {loading ? "..." : stats?.offlineRecords || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">System Status</p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                  Online
                </Badge>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {adminActions.map((action) => (
          <Card key={action.title} className="glass-card-hover border-border/80 bg-card/90">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{action.title}</p>
                    {action.count !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        {action.count}
                      </Badge>
                    )}
                    {action.status && (
                      <Badge variant="secondary" className="text-xs bg-success/10 text-success">
                        {action.status}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-foreground">{action.description}</p>
                </div>
              </div>
              <div className="pt-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={action.onClick}
                >
                  {action.action}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Assign Survey Panel */}
      <Card className="glass-card-hover border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle className="text-xl">Assign Survey</CardTitle>
          <CardDescription>
            Give an enumerator a new field assignment with contextual details and due notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Enumerator</label>
              <select
                value={selectedEnumeratorId ?? ""}
                onChange={(event) => setSelectedEnumeratorId(Number(event.target.value) || null)}
                className="mt-2 block w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select enumerator</option>
                {enumerators.map((enumerator) => (
                  <option key={enumerator.id} value={enumerator.id}>
                    {enumerator.username} ({enumerator.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Survey description</label>
              <Textarea
                value={surveyDescription}
                onChange={(event) => setSurveyDescription(event.target.value)}
                className="mt-2 h-24"
                placeholder="E.g. Visit district A2 and confirm household details for 15 households."
              />
            </div>
          </div>

          {assignError ? <p className="text-sm text-destructive">{assignError}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Assigned surveys are tracked per enumerator and visible in each profile row.
            </div>
            <Button variant="secondary" onClick={handleAssignSurvey} disabled={assignLoading || enumerators.length === 0}>
              {assignLoading ? 'Assigning...' : 'Assign Survey'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enumerator Overview */}
      <Card className="glass-card-hover border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Users2 className="h-5 w-5 text-primary" />
            Enumerator Performance
          </CardTitle>
          <CardDescription>
            Monitor each enumerator's submission activity, sync behavior, and assigned work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading enumerator data...</p>
          ) : enumerators.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No enumerators registered yet</p>
          ) : (
            <div className="space-y-4">
              {enumerators.map((enumerator) => (
                <div key={enumerator.id} className="rounded-3xl border border-border/70 bg-background/80 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{enumerator.username}</p>
                      <p className="text-sm text-muted-foreground">{enumerator.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="capitalize">{enumerator.role}</Badge>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">Joined {new Date(enumerator.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Total submissions</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{enumerator.totalRecords}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Online</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{enumerator.onlineRecords}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Offline</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{enumerator.offlineRecords}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Last submitted</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {enumerator.lastSubmissionAt ? new Date(enumerator.lastSubmissionAt).toLocaleString() : 'None'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-3xl border border-border/70 bg-background/80 p-4">
                    <p className="text-sm font-semibold text-foreground">Assigned surveys</p>
                    {enumerator.assigned_surveys.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">No surveys assigned yet.</p>
                    ) : (
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {enumerator.assigned_surveys.map((survey, idx) => (
                          <li key={`${enumerator.id}-${idx}`} className="rounded-2xl border border-border/70 bg-card/80 p-3">
                            <p>{survey.name}</p>
                            <p className="text-xs text-muted-foreground">Assigned {new Date(survey.assigned_at).toLocaleString()}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}