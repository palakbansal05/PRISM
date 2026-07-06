/**
 * Scheduler Manager
 * 
 * Runs in the main thread. Spawns the scheduler worker thread
 * and handles communication (alert dispatch via Nodemailer + Socket.IO events).
 * 
 * Message types from worker:
 *   INCIDENT_OPENED   → New incident created (HEALTHY→DOWN). Send email + emit socket.
 *   INCIDENT_UPDATED  → Existing incident updated (still DOWN). Emit socket only, NO email.
 *   INCIDENT_RESOLVED → Incident resolved (DOWN→HEALTHY). Send recovery email + emit socket.
 *   CHECK_OK          → Normal successful check. Emit socket for live dashboard.
 */

const { Worker } = require('worker_threads');
const path = require('path');
const Endpoint = require('./models/Endpoint');
const mailer = require('./utils/mailer');

let worker = null;

/**
 * Start the scheduler worker thread
 */
function start() {
  const workerPath = path.join(__dirname, 'schedulerWorker.js');

  worker = new Worker(workerPath, {
    workerData: {
      mongoUri: process.env.MONGO_URI,
    },
  });

  // Expose the worker's postMessage as a global channel for route handlers
  global.schedulerChannel = worker;

  worker.on('message', async (msg) => {
    switch (msg.type) {
      // ──── NEW INCIDENT (first failure → DOWN) ────
      case 'INCIDENT_OPENED':
        if (global.io) {
          global.io.emit('incident:new', {
            endpointId: msg.endpointId,
            endpointName: msg.endpointName,
            incident: msg.incident,
          });
        }

        // Send ONE failure alert email
        try {
          const endpoint = await Endpoint.findById(msg.endpointId);
          if (endpoint && endpoint.alertEmail) {
            await mailer.sendDownAlert(endpoint, msg.incident);
          }
        } catch (err) {
          console.error('Alert dispatch error:', err.message);
        }
        break;

      // ──── STILL FAILING (update existing incident) ────
      case 'INCIDENT_UPDATED':
        // Only emit socket for live dashboard — NO email
        if (global.io) {
          global.io.emit('incident:update', {
            endpointId: msg.endpointId,
            endpointName: msg.endpointName,
            incidentId: msg.incidentId,
            failureCount: msg.failureCount,
            ping: msg.ping,
          });
        }
        break;

      // ──── RECOVERED (DOWN → UP) ────
      case 'INCIDENT_RESOLVED':
        if (global.io) {
          global.io.emit('incident:resolved', {
            endpointId: msg.endpointId,
            endpointName: msg.endpointName,
            incident: msg.incident,
          });
        }

        // Send ONE recovery email
        try {
          const endpoint = await Endpoint.findById(msg.endpointId);
          if (endpoint && endpoint.alertEmail) {
            await mailer.sendRecoveryAlert(endpoint, msg.incident);
          }
        } catch (err) {
          console.error('Recovery alert dispatch error:', err.message);
        }
        break;

      // ──── NORMAL OK PING ────
      case 'CHECK_OK':
        if (global.io) {
          global.io.emit('ping:update', {
            endpointId: msg.endpointId,
            endpointName: msg.endpointName,
            ping: msg.ping,
          });
        }
        break;

      // ──── PERFORMANCE DEGRADED (UP → DEGRADED) ────
      case 'PERFORMANCE_DEGRADED':
        if (global.io) {
          global.io.emit('performance:degraded', {
            endpointId: msg.endpointId,
            endpointName: msg.endpointName,
            ping: msg.ping,
            latencyMs: msg.latencyMs,
            expectedResponseMs: msg.expectedResponseMs,
          });
        }

        // Send ONE degraded alert email (only fires on state change)
        try {
          const endpoint = await Endpoint.findById(msg.endpointId);
          if (endpoint && endpoint.alertEmail) {
            await mailer.sendDegradedAlert(endpoint, msg.ping);
          }
        } catch (err) {
          console.error('Degraded alert dispatch error:', err.message);
        }
        break;

      // ──── PERFORMANCE RECOVERED (DEGRADED → UP) ────
      case 'PERFORMANCE_RECOVERED':
        if (global.io) {
          global.io.emit('performance:recovered', {
            endpointId: msg.endpointId,
            endpointName: msg.endpointName,
            ping: msg.ping,
            latencyMs: msg.latencyMs,
            expectedResponseMs: msg.expectedResponseMs,
          });
        }
        // No email for performance recovery — just socket update
        break;
    }
  });

  worker.on('error', (err) => {
    console.error('[Scheduler Worker] Error:', err);
  });

  worker.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[Scheduler Worker] Exited with code ${code}. Restarting in 5s...`);
      setTimeout(start, 5000);
    }
  });

  console.log('🔄 Scheduler worker thread started');
}

module.exports = { start };
