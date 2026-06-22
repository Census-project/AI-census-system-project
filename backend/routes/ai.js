const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();

const normalizeQuery = (query = '') => query.toLowerCase();

const claudeClient = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

const buildAIPrompt = (query, records) => {
  const geotagged = records.filter((r) => r.gps_latitude !== null && r.gps_longitude !== null).length;
  const online = records.filter((r) => r.submission_type === 'online').length;
  const offline = records.length - online;
  const males = records.filter((r) => r.gender === 'M').length;
  const females = records.filter((r) => r.gender === 'F').length;
  const avgAge = records.filter((r) => typeof r.age === 'number').map((r) => r.age);
  const avgAgeValue = avgAge.length ? Math.round(avgAge.reduce((sum, value) => sum + value, 0) / avgAge.length) : 'N/A';
  
  const states = records.reduce((acc, r) => {
    const state = r.state || 'Unknown';
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, {});
  const topState = Object.entries(states).sort((a, b) => b[1] - a[1])[0] || ['Unknown', 0];

  return `You are a helpful assistant for a Nigerian census data collection dashboard. Use the dataset summary below to answer the user's question clearly and concisely. Provide specific numbers and insights. Do not invent unsupported facts.

Dataset Summary:
- Total records: ${records.length}
- Males: ${males}
- Females: ${females}
- Gender ratio: ${males}:${females}
- Average age: ${avgAgeValue} years
- Geotagged records: ${geotagged}
- Online submissions: ${online}
- Offline submissions: ${offline}
- Top state: ${topState[0]} (${topState[1]} records)
- Total states represented: ${Object.keys(states).length}

User's question: ${query}

Provide a clear, concise answer with specific numbers from the data above.`;
};

router.post('/query', verifyToken, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string is required' });
    }

    const lowerQuery = normalizeQuery(query);
    const { rows: records } = await pool.query('SELECT * FROM census_records');

    const getCount = (filter) => records.filter(filter).length;

    let result = null;

    if (lowerQuery.includes('how many') || lowerQuery.includes('count') || lowerQuery.includes('total')) {
      if (lowerQuery.includes('male') || lowerQuery.includes('men')) {
        result = { type: 'count', title: 'Male Records', value: getCount((r) => r.gender === 'M') };
      } else if (lowerQuery.includes('female') || lowerQuery.includes('women')) {
        result = { type: 'count', title: 'Female Records', value: getCount((r) => r.gender === 'F') };
      } else if (lowerQuery.includes('geotagged') || lowerQuery.includes('coordinates')) {
        result = { type: 'count', title: 'Geotagged Records', value: getCount((r) => r.gps_latitude !== null && r.gps_longitude !== null) };
      } else if (lowerQuery.includes('online')) {
        result = { type: 'count', title: 'Online Submissions', value: getCount((r) => r.submission_type === 'online') };
      } else if (lowerQuery.includes('offline')) {
        result = { type: 'count', title: 'Offline Submissions', value: getCount((r) => r.submission_type !== 'online') };
      } else if (lowerQuery.includes('household')) {
        result = { type: 'count', title: 'Total Households', value: records.length };
      } else {
        result = { type: 'count', title: 'Total Records', value: records.length };
      }
    } else if (lowerQuery.includes('gender') && (lowerQuery.includes('ratio') || lowerQuery.includes('breakdown') || lowerQuery.includes('distribution'))) {
      const maleCount = getCount((r) => r.gender === 'M');
      const femaleCount = getCount((r) => r.gender === 'F');
      result = {
        type: 'percentage',
        title: 'Gender Distribution',
        value: `M: ${maleCount}, F: ${femaleCount}`,
        details: `Male: ${Math.round((maleCount / records.length) * 100)}%, Female: ${Math.round((femaleCount / records.length) * 100)}%`,
        data: [['Male', maleCount], ['Female', femaleCount]]
      };
    } else if (lowerQuery.includes('average') || lowerQuery.includes('avg') || lowerQuery.includes('mean')) {
      if (lowerQuery.includes('age')) {
        const ages = records.filter((r) => typeof r.age === 'number').map((r) => r.age);
        const avg = ages.length ? Math.round(ages.reduce((sum, value) => sum + value, 0) / ages.length) : 0;
        result = { type: 'average', title: 'Average Age', value: avg, details: 'years' };
      }
    } else if (lowerQuery.includes('state') || lowerQuery.includes('location') || lowerQuery.includes('area') || lowerQuery.includes('region')) {
      if (lowerQuery.includes('state') && (lowerQuery.includes('breakdown') || lowerQuery.includes('distribution') || lowerQuery.includes('by state'))) {
        const states = records.reduce((acc, r) => {
          const state = r.state || r.location_address?.split(',')[0] || 'Unknown';
          acc[state] = (acc[state] || 0) + 1;
          return acc;
        }, {});
        result = {
          type: 'list',
          title: 'Records by State',
          value: `Data across ${Object.keys(states).length} states`,
          data: Object.entries(states).sort((a, b) => b[1] - a[1]).slice(0, 10)
        };
      } else {
        const locations = records.reduce((acc, r) => {
          const loc = String(r.location_address || 'Unknown').split(',')[0].trim() || 'Unknown';
          acc[loc] = (acc[loc] || 0) + 1;
          return acc;
        }, {});
        const topLocation = Object.entries(locations).sort((a, b) => b[1] - a[1])[0];
        result = {
          type: 'list',
          title: 'Top Location',
          value: topLocation ? `${topLocation[0]} (${topLocation[1]} records)` : 'No data',
          data: Object.entries(locations).slice(0, 5)
        };
      }
    } else if (lowerQuery.includes('age') && (lowerQuery.includes('distribution') || lowerQuery.includes('breakdown'))) {
      const ageGroups = records.reduce((acc, r) => {
        const age = Number(r.age);
        const group = Number.isFinite(age)
          ? age <= 17 ? '0-17' : age <= 35 ? '18-35' : age <= 59 ? '36-59' : '60+'
          : 'Unknown';
        acc[group] = (acc[group] || 0) + 1;
        return acc;
      }, {});
      result = { type: 'list', title: 'Age Distribution', value: 'Breakdown by age groups', data: Object.entries(ageGroups) };
    } else if (lowerQuery.includes('percentage') || lowerQuery.includes('percent') || lowerQuery.includes('%')) {
      if (lowerQuery.includes('geotagged')) {
        const count = getCount((r) => r.gps_latitude !== null && r.gps_longitude !== null);
        const percentage = records.length ? Math.round((count / records.length) * 100) : 0;
        result = { type: 'percentage', title: 'Geotagged Records', value: `${percentage}%` };
      } else if (lowerQuery.includes('online')) {
        const count = getCount((r) => r.submission_type === 'online');
        const percentage = records.length ? Math.round((count / records.length) * 100) : 0;
        result = { type: 'percentage', title: 'Online Submissions', value: `${percentage}%` };
      }
    } else if (lowerQuery.includes('trend') || lowerQuery.includes('recent') || lowerQuery.includes('last')) {
      const trend = records
        .slice(-5)
        .map((record) => ({ date: record.submission_timestamp?.toISOString?.() || String(record.created_at), count: 1 }));
      result = { type: 'trend', title: 'Recent Submissions', value: `${trend.length} recent records`, data: trend };
    }

    if (claudeClient) {
      const prompt = buildAIPrompt(query, records);
      try {
        const response = await claudeClient.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });

        const answer = response.content[0]?.type === 'text' 
          ? response.content[0].text 
          : 'I could not generate an answer at this time.';

        return res.json({ success: true, result: { type: 'count', title: 'Claude Analysis', value: answer } });
      } catch (claudeError) {
        console.error('Claude API error:', claudeError);
        // Fall back to rule-based answer if Claude fails
      }
    }

    if (result) {
      return res.json({ success: true, result });
    }

    return res.json({ success: false, message: 'Query not understood. Try asking about counts, averages, locations, gender distribution, state breakdown, or trends.' });
  } catch (err) {
    console.error('AI query error:', err);
    res.status(500).json({ error: 'AI query processing failed' });
  }
});

router.get('/insights', verifyToken, async (req, res) => {
  try {
    const { rows: censusRecords } = await pool.query('SELECT * FROM census_records');
    if (censusRecords.length === 0) {
      return res.json({ insights: ['No records available yet. Capture data to generate AI insights.'] });
    }

    const total = censusRecords.length;
    const geotagged = censusRecords.filter((r) => r.gps_latitude !== null && r.gps_longitude !== null).length;
    const offline = censusRecords.filter((r) => r.submission_type !== 'online').length;
    const ageGroups = censusRecords.reduce((acc, r) => {
      const age = Number(r.age);
      const group = Number.isFinite(age)
        ? age <= 17 ? '0-17' : age <= 35 ? '18-35' : age <= 59 ? '36-59' : '60+'
        : 'Unknown';
      acc[group] = (acc[group] || 0) + 1;
      return acc;
    }, {});
    const topGroup = Object.entries(ageGroups).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
    const projectedNextWave = Math.max(total + 1, Math.round(total * 1.08));

    const insights = [
      `AI predicts the next reporting wave could reach approximately ${projectedNextWave} records if current submission momentum continues.`,
      `${Math.round((geotagged / total) * 100)}% of records are geotagged, which supports location-driven planning.`,
      `The most represented age group is ${topGroup}. Use this to refine survey targeting and follow-up outreach.`,
      `There are currently ${offline} offline records. Prioritize syncing them to keep the dataset current and reliable.`,
    ];

    res.json({ insights });
  } catch (err) {
    console.error('AI insights error:', err);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

router.post('/validation', verifyToken, (req, res) => {
  try {
    const record = req.body;
    const hints = [];

    if (!record.household_id?.trim()) {
      hints.push('Household ID is missing. Auto-generate one to avoid duplicates.');
    }
    if (!record.first_name?.trim() || !record.last_name?.trim()) {
      hints.push('Please provide both first name and last name for accurate identity matching.');
    }
    if (record.age && !/^[0-9]{1,3}$/.test(String(record.age))) {
      hints.push('Age should be a whole number between 0 and 150.');
    }
    if (record.age && Number(record.age) > 100) {
      hints.push('This age is unusually high; please confirm it with the respondent.');
    }
    if (record.phone && !/^\+?[0-9]{10,15}$/.test(record.phone)) {
      hints.push('Phone number appears to be in an invalid format.');
    }
    if (!record.location_address?.trim() && record.gps_latitude !== null && record.gps_longitude !== null) {
      hints.push('GPS coordinates are available. Add a matching address for better location records.');
    }
    if (record.gps_latitude === null || record.gps_longitude === null) {
      hints.push('Capture GPS coordinates when possible to improve spatial analysis.');
    }

    res.json({ hints });
  } catch (err) {
    console.error('AI validation error:', err);
    res.status(500).json({ error: 'Failed to generate validation hints' });
  }
});

router.post('/anomaly', verifyToken, (req, res) => {
  try {
    const record = req.body;
    let score = 0;

    if (!record.household_id?.trim()) score += 20;
    if (!record.first_name?.trim() || !record.last_name?.trim()) score += 20;
    if (!record.location_address?.trim()) score += 15;
    if (record.gps_latitude === null || record.gps_longitude === null) score += 20;
    if (record.age && Number(record.age) > 90) score += 15;
    if (record.phone && !/^\+?[0-9]{10,15}$/.test(record.phone)) score += 10;

    res.json({ anomalyScore: Math.min(100, score) });
  } catch (err) {
    console.error('AI anomaly error:', err);
    res.status(500).json({ error: 'Failed to compute anomaly score' });
  }
});

router.get('/mapping', verifyToken, async (req, res) => {
  try {
    const { rows: censusRecords } = await pool.query('SELECT * FROM census_records');

    if (censusRecords.length === 0) {
      return res.json({ recommendation: 'No coordinate data available yet. Start collecting GPS-enabled records to get mapping recommendations.' });
    }

    const onlineRecords = censusRecords.filter((r) => r.submission_type === 'online');
    const offlineCount = censusRecords.length - onlineRecords.length;
    const geotaggedRecords = censusRecords.filter((r) => r.gps_latitude !== null && r.gps_longitude !== null);
    let recommendation = '';

    if (geotaggedRecords.length < censusRecords.length * 0.5) {
      recommendation = `Only ${geotaggedRecords.length} out of ${censusRecords.length} records have GPS coordinates. Focus on capturing location data for better spatial analysis.`;
    } else if (offlineCount > 0) {
      recommendation = `You have ${offlineCount} offline records. Prioritize syncing these to include their coordinates in mapping analysis.`;
    } else {
      const avgLat = geotaggedRecords.reduce((sum, r) => sum + r.gps_latitude, 0) / geotaggedRecords.length;
      const avgLng = geotaggedRecords.reduce((sum, r) => sum + r.gps_longitude, 0) / geotaggedRecords.length;
      recommendation = `Data collection is well-geotagged. The central collection area is approximately at coordinates (${avgLat.toFixed(4)}, ${avgLng.toFixed(4)}). Consider expanding collection to surrounding areas.`;
    }

    res.json({ recommendation });
  } catch (err) {
    console.error('AI mapping error:', err);
    res.status(500).json({ error: 'Failed to generate mapping recommendation' });
  }
});

module.exports = router;
