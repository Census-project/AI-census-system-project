import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Users2, BarChart3, ClipboardList, MapPin, Clock3 } from "lucide-react";

interface AssignedSurvey {
  name: string;
  assigned_at: string;
}

interface UserSummary {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
  assigned_surveys: AssignedSurvey[];
  totalRecords: number;
  onlineRecords: number;
  offlineRecords: number;
  lastSubmissionAt: string | null;
}

interface CensusRecord {
  id: number;
  household_id: string;
  first_name: string;
  last_name: string;
  submission_type: string;
  sync_status: string;
  submission_timestamp: string;
  created_at: string;
  enumerator_id: number;
}

export default function SupervisorDashboard() {
  const [enumerators, setEnumerators] = useState<UserSummary[]>([]);
  const [records, setRecords] = useState<CensusRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSupervisorData = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const [usersResponse, recordsResponse] = await Promise.all([
          api.getUsers(token),
          api.getCensusRecords(token, { limit: 50 }),
        ]);

        setEnumerators(usersResponse.users.filter((user: UserSummary) => user.role === 'enumerator'));
        setRecords(recordsResponse.data || []);
      } catch (error) {
        console.error('Supervisor data load failed:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSupervisorData();
  }, []);

  const totalSubmissions = records.length;
  const uniqueHouseholds = new Set(records.map((record) => record.household_id)).size;
  const lastSubmission = records.reduce((latest, record) => {
    const recordTime = new Date(record.created_at).getTime();
    return recordTime > latest ? recordTime : latest;
  }, 0);

  const topEnumerators = [...enumerators].sort((a, b) => b.totalRecords - a.totalRecords).slice(0, 4);

  return (
    <section className="space-y-6" aria-labelledby="supervisor-heading">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-card relative overflow-hidden p-6"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Supervisor Overview</p>
            <h3 id="supervisor-heading" className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Enumerator coordination center
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Monitor enumerator activity, confirm household coverage, and validate live census submissions.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground">
            <Users2 className="h-3.5 w-3.5 text-primary" />
            Supervisor access granted
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card-hover">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Active enumerators</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {loading ? '...' : enumerators.length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Live submissions</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{loading ? '...' : totalSubmissions}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Households covered</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{loading ? '...' : uniqueHouseholds}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Last submission</p>
              <p className="mt-2 text-sm font-semibold tracking-tight text-foreground">
                {loading ? '...' : lastSubmission ? new Date(lastSubmission).toLocaleString() : 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="glass-card-hover border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle className="text-xl">Enumerator performance</CardTitle>
            <CardDescription>Live counts for each enumerator, plus assigned survey history with their latest activity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading enumerator activity...</p>
            ) : enumerators.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No enumerators found.</p>
            ) : (
              <div className="space-y-4">
                {enumerators.map((enumerator) => (
                  <div key={enumerator.id} className="rounded-3xl border border-border/70 bg-background/80 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-foreground">{enumerator.username}</p>
                        <p className="text-sm text-muted-foreground">{enumerator.email}</p>
                      </div>
                      <Badge variant="secondary" className="capitalize">{enumerator.role}</Badge>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Total submissions</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{enumerator.totalRecords}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Last submission</p>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {enumerator.lastSubmissionAt ? new Date(enumerator.lastSubmissionAt).toLocaleString() : 'No submissions'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Assigned surveys</p>
                        <p className="mt-2 text-sm font-semibold text-foreground">{enumerator.assigned_surveys.length}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card-hover border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle className="text-xl">Top enumerators</CardTitle>
            <CardDescription>Reviewer highlights based on the latest submission volume.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topEnumerators.map((enumerator) => (
              <div key={enumerator.id} className="rounded-3xl border border-border/70 bg-background/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground">{enumerator.username}</p>
                    <p className="text-xs text-muted-foreground">{enumerator.email}</p>
                  </div>
                  <span className="text-xs font-medium text-foreground">{enumerator.totalRecords} records</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card-hover border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle className="text-xl">Recent survey submissions</CardTitle>
          <CardDescription>Latest household-level submissions from all enumerators.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading recent submissions...</p>
          ) : records.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No recent submissions available.</p>
          ) : (
            <div className="space-y-3">
              {records.slice(0, 5).map((record) => (
                <div key={record.id} className="rounded-3xl border border-border/70 bg-background/80 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{record.household_id}</p>
                      <p className="text-sm text-muted-foreground">{record.first_name} {record.last_name}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{record.submission_type}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(record.created_at).toLocaleString()}</span>
                    </div>
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
