import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { nigeriaStates } from "@/lib/nigeria";
import { ClipboardList, CheckCircle2, Clock3, MapPin, Sparkles } from "lucide-react";

interface CensusRecord {
  id: number;
  household_id: string;
  first_name: string;
  last_name: string;
  age: number | null;
  gender: string | null;
  submission_type: string;
  sync_status: string;
  created_at: string;
  location_address: string | null;
}

function resolveStateFromAddress(address: string | null | undefined) {
  if (!address) return "Unknown";
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : address;
}

export default function EnumeratorDashboard() {
  const [records, setRecords] = useState<CensusRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [coverageScope, setCoverageScope] = useState<'state' | 'national'>('state');
  const [selectedState, setSelectedState] = useState('');
  const [selectedLga, setSelectedLga] = useState('');

  useEffect(() => {
    const fetchEnumeratorRecords = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const result = await api.getCensusRecords(token, { limit: 1000 });
        const data = (result.data || []) as CensusRecord[];
        setRecords(data);

        if (nigeriaStates.length > 0) {
          setSelectedState('');
          setSelectedLga('');
        }
      } catch (error) {
        console.error('Failed to load enumerator records:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEnumeratorRecords();
  }, []);

  const allStates = nigeriaStates.map((state) => state.name);
  const availableLgas = nigeriaStates.find((state) => state.name === selectedState)?.lgas ?? [];
  const filteredRecords = coverageScope === 'national' || !selectedState
    ? records
    : records.filter((record) => {
        const recordState = resolveStateFromAddress(record.location_address);
        if (recordState !== selectedState) {
          return false;
        }
        if (!selectedLga) {
          return true;
        }
        return record.location_address?.toLowerCase().includes(selectedLga.toLowerCase()) ?? false;
      });

  const totalHouseholds = new Set(filteredRecords.map((record) => record.household_id)).size;
  const onlineCount = filteredRecords.filter((record) => record.submission_type === 'online').length;
  const offlineCount = filteredRecords.filter((record) => record.submission_type !== 'online').length;
  const coverageZones = new Set(filteredRecords.map((record) => resolveStateFromAddress(record.location_address))).size;
  const lastSubmission = filteredRecords.reduce((latest, record) => {
    const recordTime = new Date(record.created_at).getTime();
    return recordTime > latest ? recordTime : latest;
  }, 0);

  return (
    <section className="space-y-6" aria-labelledby="enumerator-heading">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-card relative overflow-hidden p-6"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Enumerator Dashboard</p>
            <h3 id="enumerator-heading" className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Field submission summary
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Live details for your current household work and recent submissions.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Real-time record sync
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Coverage scope</p>
                <p className="mt-2 text-sm text-foreground">Choose between state-wide only or national coverage.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-3 py-2">
                <input
                  type="radio"
                  name="coverageScope"
                  checked={coverageScope === 'state'}
                  onChange={() => setCoverageScope('state')}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">State-wide only</span>
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-3 py-2">
                <input
                  type="radio"
                  name="coverageScope"
                  checked={coverageScope === 'national'}
                  onChange={() => setCoverageScope('national')}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">National coverage</span>
              </label>
              {coverageScope === 'state' && (
                <select
                  value={selectedState}
                  onChange={(event) => {
                    setSelectedState(event.target.value);
                    setSelectedLga('');
                  }}
                  className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a state</option>
                  {allStates.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              )}

              {coverageScope === 'state' && selectedState && (
                <select
                  value={selectedLga}
                  onChange={(event) => setSelectedLga(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All local government areas</option>
                  {availableLgas.map((lga) => (
                    <option key={lga} value={lga}>{lga}</option>
                  ))}
                </select>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Households logged</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {loading ? '...' : totalHouseholds}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Online submissions</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {loading ? '...' : onlineCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Offline submissions</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {loading ? '...' : offlineCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Coverage zones</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {loading ? '...' : coverageZones}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card-hover border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle className="text-xl">Recent household submissions</CardTitle>
          <CardDescription>Review the latest records submitted under your current field work.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading your latest records...</p>
          ) : filteredRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No census submissions yet for the selected coverage scope.</p>
          ) : (
            <div className="space-y-3">
              {filteredRecords.slice(0, 6).map((record) => (
                <div key={record.id} className="rounded-3xl border border-border/70 bg-background/80 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{record.household_id}</p>
                      <p className="text-sm text-muted-foreground">
                        {record.first_name} {record.last_name} • {record.gender || 'Unknown'}, age {record.age ?? 'N/A'}
                      </p>
                    </div>
                    <Badge variant={record.submission_type === 'online' ? 'secondary' : 'outline'} className="capitalize">
                      {record.submission_type}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{record.location_address || 'Address missing'}</span>
                    <span>{new Date(record.created_at).toLocaleString()}</span>
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
