# Claude AI Integration Guide

This guide explains how to set up Claude AI for the Natural Language Query system in the Census Application.

## What Changed?

The system has been upgraded from OpenAI to **Claude AI (Anthropic)** with significantly expanded query capabilities.

## Features Added

### 1. **Expanded Query Patterns**
Your app now understands these question types:

| Category | Examples |
|----------|----------|
| **Gender Analysis** | "How many males?" "Female breakdown?" "Gender ratio?" |
| **State-wise Data** | "Records by state?" "Top states?" "State breakdown?" |
| **Household Analysis** | "Total households?" "Household count?" |
| **Demographics** | "Average age?" "Age distribution?" |
| **Submission Types** | "Online vs offline?" "Geotagged records?" |
| **Trends** | "Recent submissions?" "Latest records?" |

### 2. **Claude AI Integration**
When ANTHROPIC_API_KEY is configured, Claude can answer **any census question** in natural language, not just predefined patterns.

Example questions Claude can now answer:
- "What's the population distribution by gender and state?"
- "Are there more offline or online submissions?"
- "Which age group has the most records in Lagos?"
- "What percentage of records have GPS coordinates?"

## Setup Instructions

### Step 1: Get a Claude API Key

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

### Step 2: Configure Environment Variable

Add your API key to `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
```

### Step 3: Restart the Backend Server

Kill the running backend process and restart:

```bash
cd backend
npm run dev:local
# or
npm run dev
```

### Step 4: Test the Integration

In the AI Assistant component, try these queries:

```
"How many male and female records do we have?"
"Show me the age distribution across different states"
"What's our data quality - how many records have GPS?"
"Compare online vs offline submissions"
```

## How It Works

### Without ANTHROPIC_API_KEY (Rule-Based Mode)
- System uses predefined query patterns
- Fast, no API calls needed
- Limited to recognized question types
- Falls back to: "Query not understood. Try asking about counts, averages, locations, gender distribution, state breakdown, or trends."

### With ANTHROPIC_API_KEY (AI-Powered Mode)
- System first tries rule-based patterns
- If no match, sends to Claude AI
- Claude understands natural language
- Provides intelligent, context-aware answers
- Gracefully falls back to rule-based mode if Claude call fails

## Available Models

Default: `claude-3-5-sonnet-20241022` (fast, efficient, latest)

Other options:
- `claude-opus-4-1` (most capable, slower)
- `claude-3-haiku-20240307` (fastest, lower cost)

To change the model, edit [backend/routes/ai.js](backend/routes/ai.js) line ~110:

```javascript
model: 'claude-opus-4-1',  // Change this value
```

## Pricing

Claude AI is pay-as-you-go:
- Input: $3/million tokens
- Output: $15/million tokens

For a census app with typical queries, costs are minimal (cents per month for testing).

## Troubleshooting

### "Query not understood" message
**Cause**: ANTHROPIC_API_KEY not set or Claude API failed
**Fix**: 
1. Set ANTHROPIC_API_KEY in `.env`
2. Restart backend
3. Check backend logs for API errors

### Claude returns incomplete answers
**Cause**: `max_tokens` too low (default: 1024)
**Fix**: Increase in [backend/routes/ai.js](backend/routes/ai.js) line ~108:

```javascript
max_tokens: 2048,  // Increase this
```

### High API costs
**Cause**: Complex queries using premium models
**Fix**: 
1. Switch to `claude-3-haiku` for testing
2. Implement query caching
3. Limit max_tokens

## API Response Format

The system returns responses in this format:

```json
{
  "success": true,
  "result": {
    "type": "count|average|percentage|list|trend",
    "title": "Human-readable title",
    "value": "Display value",
    "details": "Additional info",
    "data": [[...]]  // For charting
  }
}
```

## Files Modified

- `backend/package.json` - Replaced OpenAI with @anthropic-ai/sdk
- `backend/routes/ai.js` - Full Claude integration + expanded patterns
- `backend/.env` - Added ANTHROPIC_API_KEY
- `frontend/src/components/NaturalLanguageQuery.tsx` - Already compatible

## Next Steps

1. **Set up Claude API key** - Follow Step 1-3 above
2. **Test queries** - Try the examples in Step 4
3. **Monitor logs** - Check backend console for any API errors
4. **Scale usage** - Optimize based on your query patterns

## Questions?

Refer to:
- [Anthropic Documentation](https://docs.anthropic.com/)
- [Claude API Reference](https://docs.anthropic.com/en/api/getting-started)
- [AI Route Testing Guide](./API_TESTING.md#ai-endpoints)
