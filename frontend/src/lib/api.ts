const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role: string;
  passportPhoto?: string;
}

export interface CensusData {
  household_id: string;
  first_name: string;
  last_name: string;
  age: string;
  gender: string;
  phone: string;
  nin?: string;
  bvn?: string;
  location_address: string;
  gps_latitude: number | null;
  gps_longitude: number | null;
  submission_type: string;
  timestamp: string;
  employment_status?: string;
  education_level?: string;
  health_status?: string;
  has_disability?: boolean;
  disability_type?: string;
  custom_fields?: Record<string, string>;
}

export const api = {
  login: async (data: LoginData) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(errorData.error || 'Login failed');
    }
    return res.json();
  },

  register: async (data: RegisterData) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(errorData.error || 'Registration failed');
    }
    return res.json();
  },

  submitCensus: async (data: CensusData, token: string) => {
    const res = await fetch(`${API_BASE}/api/census/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Submission failed');
    return res.json();
  },

  submitCensusBatch: async (records: CensusData[], token: string) => {
    const res = await fetch(`${API_BASE}/api/census/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ records }),
    });
    if (!res.ok) throw new Error('Batch submission failed');
    return res.json();
  },

  getCensusRecords: async (token: string, params: { page?: number; limit?: number; household_id?: string; status?: string; enumerator_id?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.household_id) query.set('household_id', params.household_id);
    if (params.status) query.set('status', params.status);
    if (params.enumerator_id) query.set('enumerator_id', String(params.enumerator_id));

    const res = await fetch(`${API_BASE}/api/census/records?${query.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to load census records');
    return res.json();
  },

  getActivityFeed: async (token: string, params: { limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));

    const res = await fetch(`${API_BASE}/api/census/activity?${query.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to load activity feed');
    return res.json();
  },

  getCensusSummary: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/census/summary`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to load census summary');
    return res.json();
  },

  // AI Auto Mode Endpoints
  processNaturalQuery: async (query: string, token: string) => {
    const res = await fetch(`${API_BASE}/api/ai/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error('AI query failed');
    return res.json();
  },

  getAIInsights: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/ai/insights`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('AI insights failed');
    return res.json();
  },

  getValidationHints: async (record: Partial<CensusData>, token: string) => {
    const res = await fetch(`${API_BASE}/api/ai/validation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(record),
    });
    if (!res.ok) throw new Error('AI validation failed');
    return res.json();
  },

  getAnomalyScore: async (record: Partial<CensusData>, token: string) => {
    const res = await fetch(`${API_BASE}/api/ai/anomaly`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(record),
    });
    if (!res.ok) throw new Error('AI anomaly check failed');
    return res.json();
  },

  getMappingRecommendation: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/ai/mapping`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('AI mapping failed');
    return res.json();
  },

  // Admin Endpoints
  getUsers: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to get users');
    return res.json();
  },

  getSystemStats: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/admin/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to get system stats');
    return res.json();
  },

  exportData: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/admin/export`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to export data');
    return res.blob();
  },

  assignSurvey: async (enumeratorId: number, surveyName: string, token: string) => {
    const res = await fetch(`${API_BASE}/api/admin/assign-survey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ enumeratorId, surveyName }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Failed to assign survey' }));
      throw new Error(errorData.error || 'Failed to assign survey');
    }
    return res.json();
  },

  uploadPassportPhoto: async (userId: number, photoData: string, token: string) => {
    const res = await fetch(`${API_BASE}/api/admin/upload-passport-photo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ userId, photoData }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Failed to upload passport photo' }));
      throw new Error(errorData.error || 'Failed to upload passport photo');
    }
    return res.json();
  },

  // Verification Endpoints
  getFlaggedRecords: async (token: string, params: { priority?: string; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.priority) query.set('priority', params.priority);
    if (params.limit) query.set('limit', String(params.limit || 50));

    const res = await fetch(`${API_BASE}/api/verify/flagged?${query.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to fetch flagged records');
    return res.json();
  },

  getVerificationReport: async (token: string, params: { period?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.period) query.set('period', params.period);

    const res = await fetch(`${API_BASE}/api/verify/report?${query.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to fetch verification report');
    return res.json();
  },

  getNotifications: async (token: string) => {
    const res = await fetch(`${API_BASE}/api/verify/notifications`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  },

  markNotificationRead: async (notificationId: string, token: string) => {
    const res = await fetch(`${API_BASE}/api/verify/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to mark notification as read');
    return res.json();
  },

  getGeoReport: async (token: string, params: { timeframe?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.timeframe) query.set('timeframe', params.timeframe);

    const res = await fetch(`${API_BASE}/api/verify/geo-report?${query.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to fetch geo-integrity report');
    return res.json();
  },

  getVerificationRecord: async (recordId: string, token: string) => {
    const res = await fetch(`${API_BASE}/api/verify/record/${recordId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to fetch verification record');
    return res.json();
  },

  submitManualReview: async (recordId: string, data: { approved: boolean; notes: string }, token: string) => {
    const res = await fetch(`${API_BASE}/api/verify/manual-review/${recordId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to submit manual review');
    return res.json();
  },
};