/**
 * Scheduler Worker Thread — Incident & Performance State Machine
 * 
 * Runs in a separate thread so health check HTTP requests never block
 * the Express event loop.
 * 
 * STATE MACHINE LOGIC (3 states: UP, DEGRADED, DOWN):
 * ─────────────────────────────────────────────────────
 * On failure (error / timeout / wrong status code):
 *   1. Check if OPEN incident exists for this endpoint
 *   2. If NO open incident  → Create incident, mark DOWN, notify main thread (sends email)
 *   3. If OPEN incident exists → Update failureCount & lastCheckedAt only (NO new incident, NO email)
 * 
 * On success (correct status code):
 *   1. Check if OPEN incident exists → Resolve it, mark UP, send recovery email
 *   2. If latency > expectedResponseMs and status was UP → mark DEGRADED, send slow email
 *   3. If latency <= expectedResponseMs and status was DEGRADED → mark UP, send perf recovery
 *   4. Otherwise → Normal OK ping update
 * 
 * TIMEOUT CLAMPING: effectiveTimeout = min(100, max(60, endpoint.timeoutSeconds))
 */

const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const axios = require('axios');

// Models will be registered after DB connection
let Endpoint, Ping, Incident;

// Track endpoints and their last check times
const endpointMap = new Map();

async function connectDB() {
  await mongoose.connect(workerData.mongoUri);
  console.log('[Scheduler Worker] Connected to MongoDB');

  // Define schemas inline (worker threads don't share models with main thread)
  const endpointSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    url: String,
    method: { type: String, default: 'GET' },
    expectedStatus: { type: Number, default: 200 },
    intervalSeconds: { type: Number, default: 60 },
    expectedResponseMs: { type: Number, default: 5000 },
    timeoutSeconds: { type: Number, default: 60 },
    headers: { type: Object, default: {} },
    body: { type: String, default: null },
    alertEmail: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    lastChecked: { type: Date, default: null },
    // State machine fields
    status: { type: String, enum: ['UP', 'DOWN', 'DEGRADED'], default: 'UP' },
    consecutiveFailures: { type: Number, default: 0 },
    consecutiveSuccesses: { type: Number, default: 0 },
    currentIncidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', default: null },
    createdAt: { type: Date, default: Date.now },
  });

  const pingSchema = new mongoose.Schema({
    endpointId: { type: mongoose.Schema.Types.ObjectId, ref: 'Endpoint' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    statusCode: { type: Number, default: null },
    latencyMs: { type: Number, default: null },
    responseBody: { type: String, default: null },
    responseHeaders: { type: Object, default: null },
    success: { type: Boolean, required: true },
    error: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  });

  pingSchema.index({ endpointId: 1, timestamp: -1 });
  pingSchema.index({ userId: 1, success: 1, timestamp: -1 });

  const incidentSchema = new mongoose.Schema({
    endpointId: { type: mongoose.Schema.Types.ObjectId, ref: 'Endpoint', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['ACTIVE', 'RESOLVED'], default: 'ACTIVE' },
    reason: { type: String, default: 'Unknown' },
    endpointName: { type: String, default: null, trim: true },
    endpointUrl: { type: String, default: null, trim: true },
    statusCodeReceived: { type: Number, default: null },
    startedAt: { type: Date, required: true, default: Date.now },
    resolvedAt: { type: Date, default: null },
    failureCount: { type: Number, default: 1 },
    lastCheckedAt: { type: Date, default: Date.now },
  });

  incidentSchema.index({ endpointId: 1, status: 1 });
  incidentSchema.index({ userId: 1, status: 1 });

  Endpoint = mongoose.model('Endpoint', endpointSchema);
  Ping = mongoose.model('Ping', pingSchema);
  Incident = mongoose.model('Incident', incidentSchema);
}

/**
 * Load all active endpoints from the database
 */
async function loadEndpoints() {
  const endpoints = await Endpoint.find({ isActive: true });
  endpointMap.clear();
  for (const ep of endpoints) {
    const obj = ep.toObject();
    endpointMap.set(ep._id.toString(), {
      ...obj,
      _id: ep._id.toString(),
      userId: ep.userId.toString(),
      currentIncidentId: ep.currentIncidentId ? ep.currentIncidentId.toString() : null,
      lastChecked: ep.lastChecked ? ep.lastChecked.getTime() : 0,
    });
  }
  console.log(`[Scheduler Worker] Loaded ${endpointMap.size} active endpoints`);
}

/**
 * Build a human-readable failure reason
 */
function buildReason(statusCode, expectedStatus, error) {
  if (error) {
    if (error.includes('timeout')) return 'Connection timeout';
    if (error.includes('ECONNREFUSED')) return 'Connection refused';
    if (error.includes('ENOTFOUND')) return 'DNS resolution failed';
    return error.substring(0, 100);
  }
  if (statusCode !== null) {
    return `HTTP ${statusCode} (expected ${expectedStatus})`;
  }
  return 'Unknown error';
}

/**
 * Execute a health check for a single endpoint
 * Implements the incident state machine transitions
 */
async function executeCheck(endpoint) {
  const startTime = Date.now();
  const endpointOid = new mongoose.Types.ObjectId(endpoint._id);
  const userOid = new mongoose.Types.ObjectId(endpoint.userId);
  let ping;

  // Treat the configured timeout as the down threshold, but allow extra time
  // for the request to finish so we can classify late responses correctly.
  const userTimeout = endpoint.timeoutSeconds || 60;
  const downThresholdMs = Math.max(1, userTimeout) * 1000;
  const requestTimeoutMs = Math.max(downThresholdMs + 30000, 120000);

  try {
    const response = await axios({
      method: endpoint.method || 'GET',
      url: endpoint.url,
      headers: endpoint.headers || {},
      data: endpoint.body || undefined,
      timeout: requestTimeoutMs,
      validateStatus: () => true, // Accept any status to record the actual code
    });

    const latencyMs = Date.now() - startTime;
    const isDownByLatency = latencyMs > downThresholdMs;
    const success = response.status === endpoint.expectedStatus && !isDownByLatency;

    // Truncate response body to 10KB
    let responseBody = '';
    if (typeof response.data === 'string') {
      responseBody = response.data.substring(0, 10000);
    } else {
      try {
        responseBody = JSON.stringify(response.data).substring(0, 10000);
      } catch {
        responseBody = '[Non-serializable response]';
      }
    }

    ping = new Ping({
      endpointId: endpointOid,
      userId: userOid,
      statusCode: response.status,
      latencyMs,
      responseBody,
      responseHeaders: response.headers || {},
      success,
      error: null,
      timestamp: new Date(),
    });

    await ping.save();

    if (isDownByLatency) {
      // Response eventually returned, but only after the configured down threshold.
      await handleFailure(
        endpoint,
        ping,
        response.status,
        `Response time ${latencyMs}ms exceeded downtime threshold ${downThresholdMs}ms`
      );
    } else if (!success) {
      // Wrong status code → treat as failure (DOWN)
      await handleFailure(endpoint, ping, response.status);
    } else {
      // Correct status code → evaluate performance
      await handleSuccess(endpoint, ping, latencyMs);
    }
  } catch (err) {
    const latencyMs = Date.now() - startTime;

    ping = new Ping({
      endpointId: endpointOid,
      userId: userOid,
      statusCode: null,
      latencyMs,
      responseBody: null,
      responseHeaders: null,
      success: false,
      error: err.message,
      timestamp: new Date(),
    });

    await ping.save();
    await handleFailure(endpoint, ping, null, err.message);
  }

  // Update lastChecked on the endpoint
  await Endpoint.updateOne(
    { _id: new mongoose.Types.ObjectId(endpoint._id) },
    { $set: { lastChecked: new Date() } }
  );
}

/**
 * FAILURE HANDLER — State machine transition
 * 
 * Case 1: No open incident → Create one, send email
 * Case 2: Open incident exists → Update it, NO new email
 */
async function handleFailure(endpoint, ping, statusCode, errorMsg) {
  const endpointOid = new mongoose.Types.ObjectId(endpoint._id);
  const userOid = new mongoose.Types.ObjectId(endpoint.userId);
  const now = new Date();
  const reason = buildReason(statusCode, endpoint.expectedStatus, errorMsg || null);

  // Check if there is already an OPEN incident for this endpoint
  const openIncident = await Incident.findOne({
    endpointId: endpointOid,
    status: 'ACTIVE',
  });

  if (!openIncident) {
    // ──── HEALTHY → FAILED transition ────
    // Create ONE new incident
    const incident = new Incident({
      endpointId: endpointOid,
      userId: userOid,
      status: 'ACTIVE',
      reason,
      endpointName: endpoint.name,
      endpointUrl: endpoint.url,
      statusCodeReceived: statusCode,
      startedAt: now,
      lastCheckedAt: now,
      failureCount: 1,
    });
    await incident.save();

    // Update endpoint status to DOWN
    await Endpoint.updateOne(
      { _id: endpointOid },
      {
        $set: {
          status: 'DOWN',
          currentIncidentId: incident._id,
          consecutiveFailures: 1,
          consecutiveSuccesses: 0,
        },
      }
    );

    // Update in-memory map
    endpoint.status = 'DOWN';
    endpoint.currentIncidentId = incident._id.toString();
    endpoint.consecutiveFailures = 1;
    endpoint.consecutiveSuccesses = 0;
    endpointMap.set(endpoint._id, endpoint);

    // Notify main thread → triggers email + Socket.IO
    parentPort.postMessage({
      type: 'INCIDENT_OPENED',
      endpointId: endpoint._id,
      endpointName: endpoint.name,
      incident: incident.toObject(),
      ping: ping.toObject(),
    });

    console.log(`🔴 [Incident OPENED] ${endpoint.name} — ${reason}`);
  } else {
    // ──── STILL FAILING (already DOWN) ────
    // Just update the existing incident — NO new incident, NO new email
    await Incident.updateOne(
      { _id: openIncident._id },
      {
        $set: { lastCheckedAt: now },
        $inc: { failureCount: 1 },
      }
    );

    // Update consecutive counters on endpoint
    await Endpoint.updateOne(
      { _id: endpointOid },
      {
        $inc: { consecutiveFailures: 1 },
        $set: { consecutiveSuccesses: 0 },
      }
    );

    endpoint.consecutiveFailures = (endpoint.consecutiveFailures || 0) + 1;
    endpoint.consecutiveSuccesses = 0;
    endpointMap.set(endpoint._id, endpoint);

    // Notify main thread for live dashboard update only (no email)
    parentPort.postMessage({
      type: 'INCIDENT_UPDATED',
      endpointId: endpoint._id,
      endpointName: endpoint.name,
      incidentId: openIncident._id.toString(),
      failureCount: openIncident.failureCount + 1,
      ping: ping.toObject(),
    });
  }
}

/**
 * SUCCESS HANDLER — State machine transition
 * 
 * Case 1: Open incident exists → Resolve it, send recovery email
 * Case 2: No open incident → Normal OK ping
 */
async function handleSuccess(endpoint, ping, latencyMs) {
  const endpointOid = new mongoose.Types.ObjectId(endpoint._id);
  const now = new Date();
  const expectedResponseMs = endpoint.expectedResponseMs || 5000;
  const isSlow = latencyMs > expectedResponseMs;

  // Check if there is an OPEN incident for this endpoint
  const openIncident = await Incident.findOne({
    endpointId: endpointOid,
    status: 'ACTIVE',
  });

  if (openIncident) {
    // ──── DOWN → UP transition (incident resolved) ────
    await Incident.updateOne(
      { _id: openIncident._id },
      {
        $set: {
          status: 'RESOLVED',
          resolvedAt: now,
          lastCheckedAt: now,
        },
      }
    );

    // Determine new status: if response was slow, stay degraded and send the slow alert.
    const newStatus = isSlow ? 'DEGRADED' : 'UP';

    await Endpoint.updateOne(
      { _id: endpointOid },
      {
        $set: {
          status: newStatus,
          currentIncidentId: null,
          consecutiveFailures: 0,
          consecutiveSuccesses: 1,
        },
      }
    );

    endpoint.status = newStatus;
    endpoint.currentIncidentId = null;
    endpoint.consecutiveFailures = 0;
    endpoint.consecutiveSuccesses = 1;
    endpointMap.set(endpoint._id, endpoint);

    if (isSlow) {
      // Slow recovery should be treated as degraded, not as a recovery email.
      parentPort.postMessage({
        type: 'PERFORMANCE_DEGRADED',
        endpointId: endpoint._id,
        endpointName: endpoint.name,
        ping: ping.toObject(),
        latencyMs,
        expectedResponseMs,
      });
    } else {
      // Build resolved incident object for email
      const resolvedIncident = openIncident.toObject();
      resolvedIncident.resolvedAt = now;
      resolvedIncident.status = 'RESOLVED';

      // Notify main thread → triggers recovery email + Socket.IO
      parentPort.postMessage({
        type: 'INCIDENT_RESOLVED',
        endpointId: endpoint._id,
        endpointName: endpoint.name,
        incident: resolvedIncident,
        ping: ping.toObject(),
      });
    }

    console.log(`🟢 [Incident RESOLVED] ${endpoint.name} — back ${newStatus}`);
  } else if (isSlow && endpoint.status !== 'DEGRADED') {
    // ──── UP → DEGRADED transition (slow but alive) ────
    // Only trigger on state CHANGE (UP → DEGRADED), not when already DEGRADED
    await Endpoint.updateOne(
      { _id: endpointOid },
      {
        $set: {
          status: 'DEGRADED',
          consecutiveFailures: 0,
        },
        $inc: { consecutiveSuccesses: 1 },
      }
    );

    endpoint.status = 'DEGRADED';
    endpoint.consecutiveSuccesses = (endpoint.consecutiveSuccesses || 0) + 1;
    endpoint.consecutiveFailures = 0;
    endpointMap.set(endpoint._id, endpoint);

    // Notify main thread → triggers slow email + Socket.IO
    parentPort.postMessage({
      type: 'PERFORMANCE_DEGRADED',
      endpointId: endpoint._id,
      endpointName: endpoint.name,
      ping: ping.toObject(),
      latencyMs,
      expectedResponseMs,
    });

    console.log(`⚠️ [DEGRADED] ${endpoint.name} — ${latencyMs}ms (expected ${expectedResponseMs}ms)`);
  } else if (!isSlow && endpoint.status === 'DEGRADED') {
    // ──── DEGRADED → UP transition (performance recovered) ────
    await Endpoint.updateOne(
      { _id: endpointOid },
      {
        $set: {
          status: 'UP',
          consecutiveFailures: 0,
        },
        $inc: { consecutiveSuccesses: 1 },
      }
    );

    endpoint.status = 'UP';
    endpoint.consecutiveSuccesses = (endpoint.consecutiveSuccesses || 0) + 1;
    endpoint.consecutiveFailures = 0;
    endpointMap.set(endpoint._id, endpoint);

    parentPort.postMessage({
      type: 'PERFORMANCE_RECOVERED',
      endpointId: endpoint._id,
      endpointName: endpoint.name,
      ping: ping.toObject(),
      latencyMs,
      expectedResponseMs,
    });

    console.log(`🟢 [PERF RECOVERED] ${endpoint.name} — ${latencyMs}ms (within ${expectedResponseMs}ms)`);
  } else {
    // ──── Steady state (already UP and fast, or already DEGRADED and still slow) ────
    await Endpoint.updateOne(
      { _id: endpointOid },
      {
        $inc: { consecutiveSuccesses: 1 },
        $set: { consecutiveFailures: 0 },
      }
    );

    endpoint.consecutiveSuccesses = (endpoint.consecutiveSuccesses || 0) + 1;
    endpoint.consecutiveFailures = 0;
    endpointMap.set(endpoint._id, endpoint);

    parentPort.postMessage({
      type: 'CHECK_OK',
      endpointId: endpoint._id,
      endpointName: endpoint.name,
      ping: ping.toObject(),
    });
  }
}

/**
 * Main scheduler loop
 * Runs every 10 seconds, checks which endpoints are due
 */
async function schedulerLoop() {
  const now = Date.now();

  for (const [id, endpoint] of endpointMap) {
    const intervalMs = (endpoint.intervalSeconds || 60) * 1000;
    const lastChecked = endpoint.lastChecked || 0;

    if (now - lastChecked >= intervalMs) {
      // Mark as checked immediately to prevent double-firing
      endpoint.lastChecked = now;
      endpointMap.set(id, endpoint);

      // Fire check (don't await — run concurrently)
      executeCheck(endpoint).catch((err) => {
        console.error(`[Scheduler] Check error for ${endpoint.name}:`, err.message);
      });
    }
  }
}

/**
 * Listen for messages from main thread
 */
parentPort.on('message', (msg) => {
  switch (msg.type) {
    case 'ADD_ENDPOINT':
      const ep = msg.endpoint;
      const epId = typeof ep._id === 'string' ? ep._id : ep._id.toString();
      endpointMap.set(epId, {
        ...ep,
        _id: epId,
        userId: typeof ep.userId === 'string' ? ep.userId : ep.userId.toString(),
        currentIncidentId: null,
        status: 'UP',
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastChecked: 0, // Check immediately
      });
      console.log(`[Scheduler] Added endpoint: ${ep.name}`);
      break;

    case 'REMOVE_ENDPOINT':
      endpointMap.delete(msg.endpointId);
      console.log(`[Scheduler] Removed endpoint: ${msg.endpointId}`);
      break;

    case 'RELOAD':
      loadEndpoints().catch(console.error);
      break;
  }
});

/**
 * Start the scheduler
 */
async function start() {
  try {
    await connectDB();
    await loadEndpoints();

    // Run the check loop every 10 seconds
    setInterval(schedulerLoop, 10000);

    // Also run immediately on start
    schedulerLoop();

    console.log('[Scheduler Worker] Running (checking every 10s)');
  } catch (err) {
    console.error('[Scheduler Worker] Fatal error:', err);
    process.exit(1);
  }
}

start();
