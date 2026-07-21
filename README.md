<div align="center">

# PRISM
### Proactive Request Inspection & Status Monitor

**Zero-agent API monitoring. Know when your APIs fail — before your users do.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-prismops.vercel.app-black?style=for-the-badge)](https://prismops.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-palakbansal05%2FPRISM-black?style=for-the-badge&logo=github)](https://github.com/palakbansal05/PRISM)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-palakbansal--05-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/in/palakbansal-05-/)

</div>

---

## The Origin Story

This project was born out of a very real, very painful moment.

I was at a hackathon. My project had been working perfectly all night — tested, solid, demo-ready. The moment I stood in front of the judging panel, **the API silently crashed.** I was left refreshing a broken screen, awkwardly explaining that *"it was working just five minutes ago."*

That moment of helplessness is why PRISM exists. I wanted a tool that gives developers the **absolute confidence** to show their project to anyone, at any time, knowing exactly what their backend is doing — live.

---

## What is PRISM?

PRISM is a **multi-tenant SaaS API Health Observatory**. You register, add your API endpoint URLs (with a custom check interval and expected status code), and PRISM continuously pings them from the outside — exactly as a real user's client would.

When an endpoint goes down, you know **instantly** — via a live dashboard update and an automated email alert. When it recovers, you get a recovery email. You get full latency history, incident timelines, and the ability to replay any failed request to compare then vs. now.

No SDKs. No server agents. No config files beyond a URL. Monitoring starts in **under 30 seconds.**

---

## Features

| Feature | Description |
|---|---|
| 🟢 **Real-Time Health Monitoring** | Configurable ping intervals per endpoint. Results pushed live to your dashboard without a page refresh. |
| 📉 **P50 / P95 / P99 Latency Tracking** | Interactive charts with 24h, 7d, 30d range selectors. Catch performance regressions the moment they start. |
| 🚨 **Smart Incident Management** | Full incident lifecycle: one email on DOWN, one on recovery. Never spammed during an outage. |
| 🔁 **Incident Replay** | Re-fire any failed request on demand. See a live side-by-side comparison: status code, latency delta, and response body vs. the original failure. |
| 📧 **Email Alerts** | Automated failure, recovery, and performance-degradation alerts via Nodemailer. |
| 🌙 **Light / Dark Theme** | Full theme toggle persisted to `localStorage`. Every component adapts via CSS variables — zero flash of unstyled content. |
| 🔒 **Multi-Tenant Auth** | JWT authentication with bcrypt password hashing. Each user's endpoints are completely isolated. |
| ⚡ **Rate Limiting** | `express-rate-limit` applied separately to auth and API routes to prevent abuse. |

---

## Architecture Deep Dive

This is where PRISM gets interesting. The engineering decisions behind it are worth understanding.

### 1. Worker Threads — Non-Blocking Health Checks

The core challenge: health checks involve making potentially hundreds of outbound HTTP requests concurrently. If these ran on Node.js's single main thread, every slow or timing-out API being monitored would block Express from responding to your own dashboard requests. That's a fundamentally broken design.

**Solution:** PRISM spawns a dedicated **Worker Thread** (`schedulerWorker.js`) using Node.js's built-in `worker_threads` module. The worker has its own event loop, its own MongoDB connection, and manages all scheduling logic independently. The main Express thread never makes a single outbound HTTP request — it only receives structured event messages from the worker.

```
Main Thread (Express + Socket.io)
    │
    │  spawns on startup
    ▼
Worker Thread (schedulerWorker.js)
    │
    ├── Runs a 10-second master loop
    ├── Maintains an in-memory endpointMap (tracks last-check timestamps)
    ├── Fires Axios HTTP pings with clamped timeouts
    └── Posts typed messages back to main thread:
        ├── INCIDENT_OPENED      → main sends alert email + Socket.io event
        ├── INCIDENT_UPDATED     → main sends Socket.io event only (no email)
        ├── INCIDENT_RESOLVED    → main sends recovery email + Socket.io event
        ├── CHECK_OK             → main emits live ping update to dashboard
        ├── PERFORMANCE_DEGRADED → latency exceeded threshold, email fires once
        └── PERFORMANCE_RECOVERED→ latency back within threshold
```

The worker is also **self-healing**: if it crashes with a non-zero exit code, the main thread automatically restarts it after 5 seconds.

```js
// server/scheduler.js
worker.on('exit', (code) => {
  if (code !== 0) {
    console.error(`[Scheduler Worker] Crashed (code ${code}). Restarting in 5s...`);
    setTimeout(start, 5000);
  }
});
```

**Timeout clamping** prevents runaway requests:
```
effectiveTimeout = min(100s, max(60s, endpoint.timeoutSeconds))
```
This ensures no single endpoint can block the worker's event loop for longer than 100 seconds.

---

### 2. WebSockets (Socket.io) — Live Push, Not Polling

Dashboards that refresh on a timer are dated and inaccurate. PRISM uses **Socket.io** for persistent, bi-directional connections between the server and every open browser tab.

When the scheduler worker posts a message, the main thread immediately emits a typed Socket.io event to **all connected clients**. The React frontend listens for these events and updates component state in real time — no polling, no stale data, no wasted bandwidth.

**Events and their dashboard effects:**

| Event | Trigger | Frontend Effect |
|---|---|---|
| `incident:new` | First failure detected | Status badge turns red, incident appears in feed |
| `incident:update` | Continued failure on existing incident | Failure count increments live on the card |
| `incident:resolved` | Endpoint recovers | Incident marked resolved, badge turns green |
| `ping:update` | Successful check | Latency chart updates, `lastChecked` refreshes |
| `performance:degraded` | Latency exceeds `expectedResponseMs` | Warning (yellow) state on endpoint card |
| `performance:recovered` | Latency back below threshold | Card returns to UP state |

The Socket.io server is attached to the same `http.Server` instance as Express, meaning only one port is needed:

```js
const server = http.createServer(app);
const io = new Server(server, { cors: { ... } });
global.io = io; // accessible from scheduler.js without circular imports
server.listen(PORT);
```

---

### 3. State Machine — Atomic, Deduplicated Incident Logic

The most critical requirement for an alert system: **do not spam**. A single outage should not generate 50 emails over 50 failed pings.

Each endpoint in PRISM follows a three-state machine: `UP` → `DOWN` → `UP`, with an optional `DEGRADED` state for latency violations.

```
                    latency > expectedResponseMs
        ┌─────────────────────────────────────────┐
        │                                         ▼
     [UP] ────── first failure ──────────────► [DOWN]
        ▲                                         │
        │                                         │ still failing:
        │     success (incident resolved)         │ only failureCount++
        └─────────────────────────────────────────┘

  DEGRADED state (latency only, not a full failure):
     [UP] ──── slow response ────► [DEGRADED] ──── fast response ────► [UP]
```

**Transition rules (fully atomic, written to MongoDB):**

- **First failure:** Create one `ACTIVE` incident → mark endpoint `DOWN` → post `INCIDENT_OPENED` to main thread → main sends alert email (once)
- **Subsequent failures:** Increment `failureCount` and `lastCheckedAt` on the existing incident only → post `INCIDENT_UPDATED` → no email
- **Recovery:** Resolve incident → mark endpoint `UP` → post `INCIDENT_RESOLVED` → main sends recovery email (once)
- **Slow response (UP → DEGRADED):** Mark endpoint `DEGRADED` → post `PERFORMANCE_DEGRADED` → main sends one degradation email
- **Perf recovery (DEGRADED → UP):** Mark endpoint `UP` → post `PERFORMANCE_RECOVERED` → no email (just a socket event)

This logic lives entirely inside the worker thread, runs sequentially per endpoint, and is completely safe from race conditions.

---

### 4. MongoDB Aggregation — Latency Percentiles

The stats route computes P50, P95, and P99 latency percentiles directly in MongoDB using an aggregation pipeline, bucketing pings by time interval and using `$percentile` or array-sort approximation:

```js
// Rough shape of the aggregation pipeline (server/routes/stats.js)
[
  { $match: { endpointId, timestamp: { $gte: rangeStart } } },
  { $sort: { timestamp: 1 } },
  { $group: {
      _id: { bucket: { $dateTrunc: { ... } } },
      latencies: { $push: '$latencyMs' },
      count: { $sum: 1 }
  }},
  { $project: {
      p50: { $arrayElemAt: ['$latencies', { $floor: { $multiply: [0.50, '$count'] } }] },
      p95: { $arrayElemAt: ['$latencies', { $floor: { $multiply: [0.95, '$count'] } }] },
      p99: { $arrayElemAt: ['$latencies', { $floor: { $multiply: [0.99, '$count'] } }] },
  }}
]
```

This approach pushes the heavy computation to the database layer, keeping the API response fast regardless of how many pings are stored.

---

## Technology Stack

### Backend
| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.21 | HTTP API server and middleware |
| `socket.io` | ^4.8 | Real-time WebSocket event push |
| `mongoose` | ^8.9 | MongoDB ODM + schema validation |
| `jsonwebtoken` | ^9.0 | Stateless JWT authentication |
| `bcryptjs` | ^2.4 | Secure password hashing (salted) |
| `axios` | ^1.7 | Outbound HTTP pings from the worker |
| `nodemailer` | ^8.0 | Transactional email alerts |
| `express-rate-limit` | ^8.5 | Route-level API abuse prevention |
| `worker_threads` | built-in | Isolated concurrent health check execution |
| `dotenv` | ^16.4 | Environment variable management |

### Frontend
| Package | Version | Purpose |
|---|---|---|
| `react` | ^19 | Component-based UI framework |
| `vite` | ^6 | Sub-100ms HMR dev server + build tool |
| `react-router-dom` | ^7 | Client-side SPA routing |
| `socket.io-client` | ^4.8 | Real-time dashboard updates |
| `recharts` | ^2 | Composable P50/P95/P99 latency charts |
| `axios` | ^1.7 | REST API calls to backend |

### Infrastructure
| Component | Provider |
|---|---|
| Frontend Hosting | Vercel |
| Backend Hosting | Node.js server (Railway / Render / Fly.io compatible) |
| Database | MongoDB Atlas (free tier sufficient for personal projects) |

---

## Database Schema

```
Collection: users
  { _id, email, passwordHash, createdAt }

Collection: endpoints
  { _id, userId, name, url, method,
    expectedStatus, intervalSeconds, expectedResponseMs, timeoutSeconds,
    headers, body, alertEmail, isActive,
    status: ('UP'|'DOWN'|'DEGRADED'),
    consecutiveFailures, consecutiveSuccesses,
    currentIncidentId, lastChecked, createdAt }

Collection: pings
  { _id, endpointId, statusCode, latencyMs,
    success, error, timestamp }

Collection: incidents
  { _id, endpointId, status: ('ACTIVE'|'RESOLVED'),
    failureCount, openedAt, resolvedAt }
```

---

## Project Structure

```
PRISM/
├── client/                          # React + Vite frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx      # Public marketing homepage
│   │   │   ├── AboutPage.jsx        # Tech stack deep-dive page
│   │   │   ├── WhyPage.jsx          # Origin story page
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── OverviewPage.jsx     # Main dashboard (WebSocket-powered)
│   │   │   ├── EndpointsPage.jsx    # Endpoint table + add/edit/delete
│   │   │   ├── IncidentsPage.jsx    # Incident timeline + replay modal
│   │   │   └── SettingsPage.jsx     # Theme toggle, alert email config
│   │   ├── components/
│   │   │   ├── PublicNavbar.jsx     # Shared navbar for public pages
│   │   │   ├── PublicFooter.jsx     # Shared footer for public pages
│   │   │   ├── Layout.jsx           # Authenticated app shell + sidebar
│   │   │   ├── ProtectedRoute.jsx   # JWT auth guard
│   │   │   └── EndpointTable.jsx    # Live updating endpoint status table
│   │   ├── context/
│   │   │   └── ThemeContext.jsx     # CSS variable injection for light/dark
│   │   └── api/                     # Axios instances + API helper functions
│   └── vercel.json                  # SPA rewrite rules for Vercel
│
└── server/                          # Node.js + Express backend
    ├── index.js                     # Entry point: Express + Socket.io + boot
    ├── scheduler.js                 # Worker manager + message dispatcher
    ├── schedulerWorker.js           # The engine: state machine + HTTP pings
    ├── models/
    │   ├── User.js
    │   ├── Endpoint.js
    │   ├── Ping.js
    │   └── Incident.js
    ├── routes/
    │   ├── auth.js                  # POST /api/auth/register, /login
    │   ├── endpoints.js             # Full CRUD + incident replay trigger
    │   ├── incidents.js             # Incident listing + manual resolution
    │   └── stats.js                 # P50/P95/P99 aggregation pipeline
    ├── middleware/
    │   └── rateLimit.js             # Separate limiters for auth vs. API
    └── utils/
        └── mailer.js                # Nodemailer: down/recovery/degraded alerts
```

---

## Getting Started

### Prerequisites
- Node.js v18+
- A MongoDB connection string (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- A Gmail account for email alerts (or any SMTP provider)

### 1. Clone the repository
```bash
git clone https://github.com/palakbansal05/PRISM.git
cd PRISM
```

### 2. Set up the backend
```bash
cd server
npm install
cp .env.example .env
```

Edit `.env` with your values:
```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/prism
JWT_SECRET=your_super_secret_key_here
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
```

> **Gmail Note:** Use a [Google App Password](https://myaccount.google.com/apppasswords) — not your actual login password.

```bash
npm run dev       # development (nodemon)
npm start         # production
```

### 3. Set up the frontend
```bash
cd ../client
npm install
npm run dev
```

Open [http://localhost:5173/welcome](http://localhost:5173/welcome) — the landing page.  
Register an account, add an endpoint URL, and watch the dashboard come alive.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | ✅ | Full MongoDB connection string |
| `JWT_SECRET` | ✅ | Secret key for signing JWTs (use a long random string) |
| `PORT` | ❌ | Server port (defaults to `5000`) |
| `EMAIL_USER` | ✅ | SMTP sender email address |
| `EMAIL_PASS` | ✅ | SMTP password or app-specific password |

---

## API Reference

> All routes marked **JWT** require an `Authorization: Bearer <token>` header.

### Authentication
| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | `{ email, password }` | Create a new user account |
| `POST` | `/api/auth/login` | `{ email, password }` | Authenticate, receive a signed JWT |

### Endpoints (JWT)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/endpoints` | List all endpoints for the authenticated user |
| `POST` | `/api/endpoints` | Add a new endpoint to monitor |
| `PUT` | `/api/endpoints/:id` | Update endpoint configuration |
| `DELETE` | `/api/endpoints/:id` | Remove an endpoint |
| `POST` | `/api/endpoints/:id/replay` | Re-fire the last failed request and return comparison data |

### Stats (JWT)
| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| `GET` | `/api/stats/overview` | — | Global: uptime %, active incidents, median latency |
| `GET` | `/api/stats/latency/:id` | `?range=24h\|7d\|30d` | P50/P95/P99 time-series for one endpoint |

### Incidents (JWT)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/incidents` | List all incidents for the authenticated user |
| `GET` | `/api/incidents/:id` | Get details of a specific incident |

---

## Deployment

**Frontend → Vercel**

The `client/vercel.json` rewrites all paths to `index.html`, which is required for any React SPA deployed to Vercel. Without it, navigating directly to `/dashboard` returns a 404.

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Backend → Any Node.js host**

Deploy `server/` to Railway, Render, Fly.io, or any VPS. Set your environment variables in the hosting dashboard. The server starts with `node index.js`.

**Database → MongoDB Atlas**

The free `M0` tier (512 MB) is sufficient for a personal or student project monitoring a few dozen endpoints.

---

## Key Design Decisions

**Why Worker Threads instead of a separate microservice?**  
Worker threads share the same process memory as the parent, making them far cheaper to spawn than a separate container or process. For a student project, they provide real concurrency benefits without operational overhead. The trade-off is that a hard crash in the worker (not handled by `try/catch`) can affect the parent — mitigated by the automatic restart logic.

**Why Socket.io over Server-Sent Events (SSE)?**  
Socket.io enables bi-directional communication. While PRISM currently only pushes server→client, the architecture supports sending messages in both directions without any changes to the transport layer — something SSE cannot do.

**Why MongoDB over PostgreSQL?**  
Ping records are time-series data with variable metadata (headers, body snippets, error strings). A schemaless document store maps naturally to this structure. MongoDB's aggregation pipeline is also first-class for the percentile calculations in `stats.js`. A relational DB would require careful index design for equivalent query performance.

**Why Vanilla CSS with custom properties over Tailwind?**  
CSS variables allow a global theme context (`ThemeContext.jsx`) to flip the entire UI between light and dark mode by injecting a single class on the `<html>` element. This is cleaner than toggling hundreds of Tailwind classes and produces zero flash of unstyled content.

**Why no polling on the frontend?**  
Polling adds artificial latency (half the interval on average), wastes server resources on repeat requests, and produces stale data between intervals. WebSockets give sub-second propagation at a fraction of the bandwidth cost of polling.

---

## Contact

| | |
|---|---|
| **Live App** | [prism-nine-ochre.vercel.app](https://prism-nine-ochre.vercel.app) |
| **GitHub** | [github.com/palakbansal05/PRISM](https://github.com/palakbansal05/PRISM) |
| **LinkedIn** | [linkedin.com/in/palakbansal-05-](https://www.linkedin.com/in/palakbansal-05-/) |
| **Email** | palakkb.05@gmail.com |

---

<div align="center">
  <i>Built because demos should never fail.</i>
</div>