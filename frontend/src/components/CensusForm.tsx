import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, RefreshCw, Send, Trash2, Sparkles, Check } from "lucide-react";
import { api, type CensusData } from "@/lib/api";
import { guessGenderFromFirstName } from "@/lib/ai";

interface HouseholdMember {
  first_name: string;
  last_name: string;
  age: string;
  gender: string;
  phone: string;
  employment_status: string;
  education_level: string;
  health_status: string;
  has_disability: boolean;
  disability_type: string;
}

interface CensusFormProps {
  isOnline: boolean;
}

const emptyMember = (): HouseholdMember => ({
  first_name: "",
  last_name: "",
  age: "",
  gender: "",
  phone: "",
  employment_status: "",
  education_level: "",
  health_status: "",
  has_disability: false,
  disability_type: "",
});

export default function CensusForm({ isOnline }: CensusFormProps) {
  const [household, setHousehold] = useState({
    household_id: "",
    location_address: "",
    gps_latitude: null as number | null,
    gps_longitude: null as number | null,
  });
  const [members, setMembers] = useState<HouseholdMember[]>([emptyMember()]);
  const [aiHints, setAiHints] = useState<string[]>([]);
  const [genderSuggestion, setGenderSuggestion] = useState<string | null>(null);
  const [anomalyScore, setAnomalyScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSubmissions, setPendingSubmissions] = useState<CensusData[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("pendingSubmissions") || "[]");
    } catch {
      return [];
    }
  });
  const [suggestions, setSuggestions] = useState({
    household_id: "",
    location_address: "",
    phone: "",
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const previewRecord: CensusData = {
    household_id: household.household_id,
    first_name: members[0].first_name,
    last_name: members[0].last_name,
    age: members[0].age,
    gender: members[0].gender,
    phone: members[0].phone,
    location_address: household.location_address,
    gps_latitude: household.gps_latitude,
    gps_longitude: household.gps_longitude,
    employment_status: members[0].employment_status,
    education_level: members[0].education_level,
    health_status: members[0].health_status,
    has_disability: members[0].has_disability,
    disability_type: members[0].disability_type,
    submission_type: "online",
    timestamp: new Date().toISOString(),
  };

  const batchMutation = useMutation({
    mutationFn: async (records: CensusData[]) => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Missing auth token');
      return api.submitCensusBatch(records, token);
    },
    onSuccess: () => {
      alert('Submission accepted by AI-assisted data gateway.');
      resetForm();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Submission failed.';
      alert(message);
    },
  });

  useEffect(() => {
    const updateAIHints = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const [hintsResponse, anomalyResponse] = await Promise.all([
          api.getValidationHints(previewRecord, token),
          api.getAnomalyScore(previewRecord, token),
        ]);
        setAiHints(hintsResponse.hints);
        setAnomalyScore(anomalyResponse.anomalyScore);
      } catch (error) {
        console.error('AI validation error:', error);
        setAiHints([]);
        setAnomalyScore(0);
      }
    };

    const timeoutId = setTimeout(updateAIHints, 500);
    setGenderSuggestion(members[0].first_name ? guessGenderFromFirstName(members[0].first_name) : null);
    return () => clearTimeout(timeoutId);
  }, [household, members]);

  const generateSuggestions = () => {
    const existingRecords = JSON.parse(localStorage.getItem("pendingSubmissions") || "[]");
    if (existingRecords.length === 0) return;

    const recentRecord = existingRecords[existingRecords.length - 1];
    const locationPattern = recentRecord.location_address?.split(",")[1]?.trim() || "";
    const phonePrefix = recentRecord.phone?.substring(0, 7) || "";

    setSuggestions({
      household_id: `HH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      location_address: locationPattern ? `${locationPattern}` : "",
      phone: phonePrefix ? `${phonePrefix}` : "",
    });
    setShowSuggestions(true);
  };

  const getLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setCurrentLocation(loc);
        setHousehold((prev) => ({ ...prev, gps_latitude: loc.latitude, gps_longitude: loc.longitude }));
      },
      () => alert('Unable to get location.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const resetForm = () => {
    setHousehold({ household_id: '', location_address: '', gps_latitude: null, gps_longitude: null });
    setMembers([emptyMember()]);
    setCurrentLocation(null);
    setShowSuggestions(false);
  };

  const validateForm = () => {
    if (!household.household_id.trim()) return 'Household ID is required';
    if (!household.location_address.trim()) return 'Location is required';
    for (const member of members) {
      if (!member.first_name.trim() || !member.last_name.trim()) return 'Each household member needs a first and last name.';
      if (!member.age || isNaN(Number(member.age)) || Number(member.age) < 0) return 'Each household member needs a valid age.';
      if (!member.gender) return 'Each household member needs a gender.';
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }

    setIsSubmitting(true);
    const records = members.map((member) => ({
      household_id: household.household_id,
      first_name: member.first_name,
      last_name: member.last_name,
      age: member.age,
      gender: member.gender,
      phone: member.phone,
      location_address: household.location_address,
      gps_latitude: household.gps_latitude,
      gps_longitude: household.gps_longitude,
      employment_status: member.employment_status,
      education_level: member.education_level,
      health_status: member.health_status,
      has_disability: member.has_disability,
      disability_type: member.disability_type,
      submission_type: isOnline ? 'online' : 'offline',
      timestamp: new Date().toISOString(),
    })) as CensusData[];

    const token = localStorage.getItem('token');

    if (isOnline && token) {
      batchMutation.mutate(records);
    } else if (isOnline && !token) {
      alert('Please login to submit online.');
    } else {
      const updated = [...pendingSubmissions, ...records];
      setPendingSubmissions(updated);
      localStorage.setItem('pendingSubmissions', JSON.stringify(updated));
      alert('Stored for offline sync.');
      resetForm();
    }

    setIsSubmitting(false);
  };

  const updateHousehold = (field: string, value: string | number | boolean) => {
    setHousehold((prev) => ({ ...prev, [field]: value }));
  };

  const updateMember = (index: number, field: keyof HouseholdMember, value: string | boolean) => {
    setMembers((prev) => prev.map((member, i) => (i === index ? { ...member, [field]: value } : member)));
  };

  const addMember = () => setMembers((prev) => [...prev, emptyMember()]);
  const removeMember = (index: number) => setMembers((prev) => prev.filter((_, i) => i !== index));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="glass-card overflow-hidden"
    >
      <div className="bg-primary px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary-foreground">Household Census Data Collection</h2>
          <p className="mt-1 text-xs text-primary-foreground/80">Capture every household member in one sweep, with smarter validation and batch submission.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={generateSuggestions}
            className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-primary-foreground/20"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Smart Fill
          </Button>
          {pendingSubmissions.length > 0 && (
            <span className="text-xs font-medium text-primary-foreground/80 bg-primary-foreground/15 px-2.5 py-1 rounded-full">
              📱 {pendingSubmissions.length} pending sync
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 border-b border-border/80 bg-muted/40 px-6 py-4">
        <p className="text-sm text-muted-foreground">Submit household profiles in one session. Each member record is stored separately for accurate analytics.</p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-foreground">
            Anomaly score: {anomalyScore}%
          </span>
          {genderSuggestion && (
            <span className="rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-foreground">
              Suggested gender: {genderSuggestion}
            </span>
          )}
        </div>
        {aiHints.length > 0 ? (
          <ul className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            {aiHints.map((hint, index) => (
              <li key={index} className="rounded-xl bg-border/10 px-3 py-2">
                • {hint}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-foreground/70">All checks passed, data is looking good.</p>
        )}
      </div>

      {showSuggestions && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-6 py-4 mx-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-primary">AI Smart Suggestions</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                updateHousehold('household_id', suggestions.household_id || household.household_id);
                updateHousehold('location_address', suggestions.location_address || household.location_address);
                setMembers((prev) => prev.map((member) => ({ ...member, phone: suggestions.phone ? suggestions.phone : member.phone })));
                setShowSuggestions(false);
              }}
              className="text-xs"
            >
              <Check className="w-3 h-3 mr-1" /> Apply All
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {suggestions.household_id && (
              <div className="flex items-center justify-between p-2 bg-background rounded border">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-mono">{suggestions.household_id}</span>
              </div>
            )}
            {suggestions.location_address && (
              <div className="flex items-center justify-between p-2 bg-background rounded border">
                <span className="text-muted-foreground">Location:</span>
                <span>{suggestions.location_address}</span>
              </div>
            )}
            {suggestions.phone && (
              <div className="flex items-center justify-between p-2 bg-background rounded border">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-mono">{suggestions.phone}****</span>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        <Section title="Household Information">
          <div className="space-y-1.5">
            <Label>Household ID</Label>
            <div className="flex gap-2 flex-col sm:flex-row">
              <Input
                value={household.household_id}
                onChange={(e) => updateHousehold('household_id', e.target.value)}
                placeholder="Auto-generate or enter manually"
                required
              />
              <Button type="button" variant="secondary" onClick={() => updateHousehold('household_id', `HH-${Date.now()}-${Math.floor(Math.random() * 1000)}`)} className="shrink-0">
                <RefreshCw className="w-4 h-4 mr-1.5" /> Generate
              </Button>
            </div>
          </div>
        </Section>

        <Section title="Household Members">
          <div className="space-y-4">
            {members.map((member, index) => (
              <div key={index} className="rounded-3xl border border-border/70 bg-background/80 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Person {index + 1}</p>
                    <p className="text-xs text-muted-foreground">Enter the personal details for this household member.</p>
                  </div>
                  {members.length > 1 && (
                    <Button type="button" variant="outline" onClick={() => removeMember(index)} className="text-xs">
                      Remove
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="First Name">
                    <Input value={member.first_name} onChange={(e) => updateMember(index, 'first_name', e.target.value)} required />
                  </Field>
                  <Field label="Last Name">
                    <Input value={member.last_name} onChange={(e) => updateMember(index, 'last_name', e.target.value)} required />
                  </Field>
                  <Field label="Age">
                    <Input type="number" min={0} max={150} value={member.age} onChange={(e) => updateMember(index, 'age', e.target.value)} required />
                  </Field>
                  <Field label="Gender">
                    <select
                      value={member.gender}
                      onChange={(e) => updateMember(index, 'gender', e.target.value)}
                      required
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Select Gender</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>
                  <Field label="Phone Number" className="sm:col-span-2">
                    <Input type="tel" value={member.phone} onChange={(e) => updateMember(index, 'phone', e.target.value)} placeholder="+234xxxxxxxxxx" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <Field label="Employment Status">
                    <select
                      value={member.employment_status}
                      onChange={(e) => updateMember(index, 'employment_status', e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Select Status</option>
                      <option value="employed">Employed</option>
                      <option value="self-employed">Self-employed</option>
                      <option value="unemployed">Unemployed</option>
                      <option value="student">Student</option>
                      <option value="retired">Retired</option>
                      <option value="homemaker">Homemaker</option>
                    </select>
                  </Field>
                  <Field label="Education Level">
                    <select
                      value={member.education_level}
                      onChange={(e) => updateMember(index, 'education_level', e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Select Level</option>
                      <option value="none">No formal education</option>
                      <option value="primary">Primary school</option>
                      <option value="secondary">Secondary school</option>
                      <option value="tertiary">Tertiary education</option>
                      <option value="vocational">Vocational training</option>
                    </select>
                  </Field>
                  <Field label="Health Status">
                    <select
                      value={member.health_status}
                      onChange={(e) => updateMember(index, 'health_status', e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Select Status</option>
                      <option value="excellent">Excellent</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                      <option value="chronic">Chronic condition</option>
                    </select>
                  </Field>
                  <Field label="Disability Status">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={member.has_disability}
                          onChange={(e) => updateMember(index, 'has_disability', e.target.checked)}
                          className="rounded border-input"
                        />
                        <span className="text-sm">Has disability or special needs</span>
                      </label>
                      {member.has_disability && (
                        <Input
                          placeholder="Specify disability type"
                          value={member.disability_type}
                          onChange={(e) => updateMember(index, 'disability_type', e.target.value)}
                          className="mt-2"
                        />
                      )}
                    </div>
                  </Field>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addMember}>
              Add another household member
            </Button>
          </div>
        </Section>

        <Section title="Location Information">
          <div className="space-y-4">
            <Field label="Address">
              <Input
                value={household.location_address}
                onChange={(e) => updateHousehold('location_address', e.target.value)}
                placeholder="Street address, city, state"
                required
              />
            </Field>
            <div className="flex items-center gap-3 flex-wrap">
              <Button type="button" variant="secondary" onClick={getLocation}>
                <MapPin className="w-4 h-4 mr-1.5" /> Get Current Location
              </Button>
              {currentLocation && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs font-mono text-muted-foreground bg-muted px-3 py-1.5 rounded-md"
                >
                  {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                </motion.span>
              )}
            </div>
          </div>
        </Section>

        <div className="flex gap-3 pt-4 border-t border-border">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            <Send className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Submitting...' : isOnline ? 'Submit Online' : 'Store for Later'}
          </Button>
          <Button type="button" variant="outline" onClick={resetForm}>
            <Trash2 className="w-4 h-4 mr-1.5" /> Clear
          </Button>
        </div>
      </form>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-primary border-b-2 border-primary pb-2">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
