/**
 * Scheduler Manager
 * 
 * Runs in the main thread. Spawns the scheduler worker thread
 * and handles communication (alert dispatch via Resend + Socket.IO events).
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
      case 'CHECK_FAILED':
        // Emit real-time event to all connected clients
        if (global.io) {
          global.io.emit('incident:new', {
            endpointId: msg.endpointId,
            endpointName: msg.endpointName,
            ping: msg.ping,
          });
        }

        // Send email alert
        try {
          const endpoint = await Endpoint.findById(msg.endpointId);
          if (endpoint && endpoint.alertEmail) {
            await mailer.sendDownAlert(endpoint, msg.ping);
          }
        } catch (err) {
          console.error('Alert dispatch error:', err.message);
        }
        break;

      case 'CHECK_RECOVERED':
        // Emit real-time recovery event
        if (global.io) {
          global.io.emit('incident:resolved', {
            endpointId: msg.endpointId,
            endpointName: msg.endpointName,
            ping: msg.ping,
          });
        }

        // Send recovery email
        try {
          const endpoint = await Endpoint.findById(msg.endpointId);
          if (endpoint && endpoint.alertEmail) {
            await mailer.sendRecoveryAlert(endpoint, msg.ping);
          }
        } catch (err) {
          console.error('Recovery alert dispatch error:', err.message);
        }
        break;

      case 'CHECK_OK':
        // Emit real-time successful check for live dashboard updates
        if (global.io) {
          global.io.emit('ping:update', {
            endpointId: msg.endpointId,
            endpointName: msg.endpointName,
            ping: msg.ping,
          });
        }
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
