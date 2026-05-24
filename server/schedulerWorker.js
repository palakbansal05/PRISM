
const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const axios = require('axios');

// We need to re-register models in the worker thread's own mongoose connection
let Endpoint, Ping;

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
    headers: { type: Object, default: {} },
    body: { type: String, default: null },
    alertEmail: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    lastChecked: { type: Date, default: null },
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

  Endpoint = mongoose.model('Endpoint', endpointSchema);
  Ping = mongoose.model('Ping', pingSchema);
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
      lastChecked: ep.lastChecked ? ep.lastChecked.getTime() : 0,
    });
  }
  console.log(`[Scheduler Worker] Loaded ${endpointMap.size} active endpoints`);
}

/**
 * Execute a health check for a single endpoint
 */
async function executeCheck(endpoint) {
  const startTime = Date.now();
  let ping;

  try {
    const response = await axios({
      method: endpoint.method || 'GET',
      url: endpoint.url,
      headers: endpoint.headers || {},
      data: endpoint.body || undefined,
      timeout: 15000,
      validateStatus: () => true, // Accept any status to record the actual code
    });

    const latencyMs = Date.now() - startTime;
    const success = response.status === endpoint.expectedStatus;

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
      endpointId: new mongoose.Types.ObjectId(endpoint._id),
      userId: new mongoose.Types.ObjectId(endpoint.userId),
      statusCode: response.status,
      latencyMs,
      responseBody,
      responseHeaders: response.headers || {},
      success,
      error: null,
      timestamp: new Date(),
    });

    await ping.save();

    // Update lastChecked on the endpoint
    await Endpoint.updateOne(
      { _id: new mongoose.Types.ObjectId(endpoint._id) },
      { $set: { lastChecked: new Date() } }
    );

    // Notify main thread about the result for alerting
    if (!success) {
      parentPort.postMessage({
        type: 'CHECK_FAILED',
        endpointId: endpoint._id.toString(),
        endpointName: endpoint.name,
        ping: ping.toObject(),
      });
    } else {
      // Check if previous ping was a failure (recovery)
      const previousPing = await Ping.findOne({
        endpointId: new mongoose.Types.ObjectId(endpoint._id),
        timestamp: { $lt: ping.timestamp },
      }).sort({ timestamp: -1 });

      if (previousPing && !previousPing.success) {
        parentPort.postMessage({
          type: 'CHECK_RECOVERED',
          endpointId: endpoint._id.toString(),
          endpointName: endpoint.name,
          ping: ping.toObject(),
        });
      } else {
        parentPort.postMessage({
          type: 'CHECK_OK',
          endpointId: endpoint._id.toString(),
          endpointName: endpoint.name,
          ping: ping.toObject(),
        });
      }
    }
  } catch (err) {
    const latencyMs = Date.now() - startTime;

    ping = new Ping({
      endpointId: new mongoose.Types.ObjectId(endpoint._id),
      userId: new mongoose.Types.ObjectId(endpoint.userId),
      statusCode: null,
      latencyMs,
      responseBody: null,
      responseHeaders: null,
      success: false,
      error: err.message,
      timestamp: new Date(),
    });

    await ping.save();

    await Endpoint.updateOne(
      { _id: new mongoose.Types.ObjectId(endpoint._id) },
      { $set: { lastChecked: new Date() } }
    );

    parentPort.postMessage({
      type: 'CHECK_FAILED',
      endpointId: endpoint._id.toString(),
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
