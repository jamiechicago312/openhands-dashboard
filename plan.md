# SDK Success Dashboard - Implementation Plan

## 📋 Overview

A dashboard to track quantitative SDK success metrics. V1 focuses on fully automated metrics from GitHub, npm, and PyPI APIs.

Based on research from the [SDK Success Notion page](https://www.notion.so/SDK-Success-3177be798a17804894f9fe3292f32537).

---

## 🎯 V1 Scope: Quantitative Metrics Only

| Metric | Source | Automatable |
|--------|--------|-------------|
| GitHub Stars | GitHub API | ✅ |
| GitHub Forks | GitHub API | ✅ |
| Active Forks (with commits) | GitHub API | ✅ |
| npm Weekly Downloads | npm API | ✅ |
| PyPI Weekly Downloads | pypistats API | ✅ |
| Dependent Repos | GitHub API | ✅ |
| Total Contributors | GitHub API | ✅ |
| Repeat Contributors | GitHub API | ✅ |

---

## 📋 Prioritized Task List

### Priority 1: Critical Path (Must Have)

| # | Task | Description | Blocked By |
|---|------|-------------|------------|
| 1 | Initialize Next.js project | Create Next.js 14 app with TypeScript, Tailwind CSS | - |
| 2 | Set up Supabase Postgres | Configure database connection with Drizzle ORM | 1 |
| 3 | Create database schema | Tables for SDKs and metrics snapshots | 2 |
| 4 | Build GitHub API integration | Fetch stars, forks, contributors | 1 |
| 5 | Build npm API integration | Fetch weekly download counts | 1 |
| 6 | Build PyPI API integration | Fetch weekly download counts | 1 |
| 7 | Create metrics collection endpoint | API route that collects all metrics | 2, 4, 5, 6 |
| 8 | Build main dashboard page | Display current metrics with cards | 7 |

### Priority 2: Core Features (Should Have)

| # | Task | Description | Blocked By |
|---|------|-------------|------------|
| 9 | Store historical snapshots | Save daily metrics to database | 7 |
| 10 | Set up Vercel Cron | Automate daily metric collection | 9 |
| 11 | Build trend charts | Visualize metrics over time (30/90 days) | 9 |
| 12 | Add active forks analysis | Count forks with commits beyond fork point | 4 |
| 13 | Add repeat contributor tracking | Identify users with 2+ contributions | 4 |
| 14 | Add dependent repos count | How many repos use the SDK | 4 |

### Priority 3: Polish (Nice to Have)

| # | Task | Description | Blocked By |
|---|------|-------------|------------|
| 15 | Add loading states | Skeleton loaders, spinners | 8 |
| 16 | Add error handling | Graceful API failure handling | 8 |
| 17 | Responsive design | Mobile-friendly layout | 8 |
| 18 | Dark mode | Theme toggle support | 8 |
| 19 | Date range selector | Filter charts by time period | 11 |
| 20 | SDK selector | Support tracking multiple SDKs | 8 |

### Priority 4: Future (V2)

| # | Task | Description | Blocked By |
|---|------|-------------|------------|
| 21 | Add showcase form | Manual entry for community projects | 8 |
| 22 | Admin panel | Manage SDKs, moderate content | 8 |
| 23 | Slack/Discord integration | Auto-capture showcases | 21 |
| 24 | GitHub webhooks | Real-time updates | 8 |

---

## 🏗️ Technical Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase Postgres |
| ORM | Drizzle ORM |
| Charts | Recharts |
| Deployment | Vercel |

---

## 📊 Database Schema (V1)

```sql
-- SDKs being tracked
CREATE TABLE sdks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  github_repo VARCHAR(255),      -- e.g., "All-Hands-AI/openhands"
  npm_package VARCHAR(255),       -- e.g., "openhands-ai"
  pypi_package VARCHAR(255),      -- e.g., "openhands-ai"
  created_at TIMESTAMP DEFAULT NOW()
);

-- Daily metric snapshots
CREATE TABLE metrics_snapshots (
  id SERIAL PRIMARY KEY,
  sdk_id INTEGER REFERENCES sdks(id),
  date DATE NOT NULL,
  github_stars INTEGER,
  github_forks INTEGER,
  github_active_forks INTEGER,
  github_contributors INTEGER,
  github_repeat_contributors INTEGER,
  github_dependent_repos INTEGER,
  npm_downloads_weekly INTEGER,
  pypi_downloads_weekly INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(sdk_id, date)
);
```

---

## 📁 Project Structure

```
oh-sdk-dashboard/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Main dashboard
│   └── api/
│       ├── metrics/route.ts        # Get metrics
│       └── cron/collect/route.ts   # Collect & store metrics
├── components/
│   ├── ui/                         # shadcn components
│   ├── metrics-card.tsx
│   └── trend-chart.tsx
├── lib/
│   ├── db.ts                       # Database connection
│   ├── schema.ts                   # Drizzle schema
│   ├── github.ts                   # GitHub API
│   ├── npm.ts                      # npm API
│   └── pypi.ts                     # PyPI API
├── drizzle.config.ts
└── package.json
```

---

## 🔑 Environment Variables

```env
# Supabase Postgres connection string
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# GitHub API (optional but recommended for higher rate limits)
GITHUB_TOKEN=

# Cron job authorization (for Vercel Cron)
CRON_SECRET=
```

---

## 🔗 API Endpoints Reference

### GitHub API
```
GET https://api.github.com/repos/{owner}/{repo}
→ stars, forks, open_issues

GET https://api.github.com/repos/{owner}/{repo}/contributors
→ contributor list with contribution counts

GET https://api.github.com/repos/{owner}/{repo}/forks
→ fork list (check pushed_at for activity)
```

### npm API
```
GET https://api.npmjs.org/downloads/point/last-week/{package}
→ { downloads: number }
```

### PyPI Stats API
```
GET https://pypistats.org/api/packages/{package}/recent
→ { data: { last_week: number } }
```

---

## ✅ Definition of Done (V1)

- [ ] Dashboard displays current metrics for one SDK
- [ ] Metrics auto-refresh daily via cron
- [ ] Historical data stored for trend analysis
- [ ] Basic trend chart showing 30-day history
- [ ] Deployed to Vercel

---

*V1 = Quantitative metrics only. Qualitative metrics (showcases, case studies) require manual curation → V2.*
