# mBT AI Suite

Context-aware AI assistant for film production budget management.

## Overview

Phase 8.2 provides intelligent budget analysis and assistance through a rules-based AI system that operates without external dependencies. The AI analyzes your budget data to provide:

- Budget overviews and forecasts
- Risk assessments
- Optimization suggestions
- Spending pattern detection
- Executive summaries

## Quick Start

### 1. Access the AI Assistant

Open: `mBT/src/tools/ai/index.html`

### 2. Use Commands

Type in the chat input:

| Command | Description |
|---------|-------------|
| `analyze` / `budget` | Analyze current budget allocation |
| `forecast` | Generate budget forecast |
| `risk` | Assess budget risks |
| `suggest` | Suggest cost-saving opportunities |
| `patterns` | Detect spending patterns |
| `executive` | Generate executive summary |
| `help` | Show available commands |

Or click the quick command buttons.

## File Structure

```
mBT/
├── src/
│   ├── config/
│   │   └── ai.js                    # AI configuration & context model
│   ├── services/
│   │   ├── ai-context.js           # Context analysis service
│   │   ├── ai-pattern-recognition.js # Pattern recognition engine
│   │   └── ai-reports.js           # Report generator
│   └── tools/
│       └── ai/
│           └── index.html          # AI Assistant UI
docs/
    └── ai/
        └── README.md               # This file
```

## Features

### Budget Overview
- Total budget, spent, remaining
- Utilization percentage
- Status indicators

### Forecast
- Spending trend analysis
- 7-day projections
- Direction indicators

### Risk Assessment
- Over-budget detection
- Missing category warnings
- High variance alerts

### Optimization Suggestions
- Industry benchmark comparisons
- Category optimization
- Anomaly detection

### Pattern Recognition
- Weekly spending cycles
- Seasonal patterns
- Spending anomalies

### Executive Summary
- Key metrics snapshot
- Status overview
- Action items

## Context-Aware Analysis

The AI automatically analyzes:
- Current project context
- Budget allocation patterns
- Historical spending (if available)
- Industry benchmarks
- Risk factors

## Response Types

| Type | Description |
|------|-------------|
| text | Simple text response |
| insight | Data-driven insight |
| alert | Critical alert |
| info | Informational message |

## Security

- All analysis runs client-side
- No data sent to external services
- Works offline
- Zero external dependencies

## Advanced Configuration

Edit `mBT/src/config/ai.js`:

```javascript
const AI_CONFIG = {
  PROVIDER: {
    TYPE: 'rules', // or 'llm' | 'hybrid'
    LLM_API_URL: 'https://api.example.com/...',
    ...
  },
  CONTEXT: {
    ANALYZE_BUDGETS: true,
    SUGGEST_CATEGORIES: true,
    ...
  }
};
```

## Limitations

- Rules-based (not LLM) in current implementation
- Requires sufficient data for pattern analysis (7+ days)
- Industry benchmarks are sample data (configure as needed)

## Next Steps

- Phase 8.1: Supabase Sync (already complete)
- Add LLM integration (optional)
- Custom report templates
- Automated insights