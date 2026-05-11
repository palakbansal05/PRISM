/**
 * Scheduler Manager
 * 
 * Runs in the main thread. Spawns the scheduler worker thread
 * and handles communication (alert dispatch via Resend).
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
        try {
          const endpoint = await Endpoint.findById(msg.endpointId);
          if (endpoint && endpoint.alertEmail) {
            await mailer.sendRecoveryAlert(endpoint, msg.ping);
          }
        } catch (err) {
          console.error('Recovery alert dispatch error:', err.message);
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
