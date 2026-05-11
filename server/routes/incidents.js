const express = require('express');
const axios = require('axios');
const Ping = require('../models/Ping');
const Endpoint = require('../models/Endpoint');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

/**
 * GET /api/incidents
 * Last 20 failed pings across all user endpoints, sorted by timestamp desc
 * Populated with endpoint name and URL
 */
router.get('/', async (req, res) => {
  try {
    const incidents = await Ping.find({
      userId: req.userId,
      success: false,
    })
      .sort({ timestamp: -1 })
      .limit(20)
      .populate('endpointId', 'name url method');

    res.json({ incidents });
  } catch (err) {
    console.error('Incidents error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * POST /api/endpoints/:id/replay
 * Re-fire the last failed request for the endpoint live
 * Returns the new result and a diff against the original failure
 */
router.post('/replay/:id', async (req, res) => {
  try {
    const endpoint = await Endpoint.findOne({ _id: req.params.id, userId: req.userId });
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found.' });
    }

    // Find the last failed ping for this endpoint
    const lastFailed = await Ping.findOne({
      endpointId: endpoint._id,
      success: false,
    }).sort({ timestamp: -1 });

    if (!lastFailed) {
      return res.status(404).json({ error: 'No failed pings found for this endpoint.' });
    }

    // Re-fire the exact same request
    const startTime = Date.now();
    let replayResult;

    try {
      const response = await axios({
        method: endpoint.method,
        url: endpoint.url,
        headers: endpoint.headers || {},
        data: endpoint.body || undefined,
        timeout: 15000,
        validateStatus: () => true, // Accept any status code
      });

      replayResult = {
        statusCode: response.status,
        latencyMs: Date.now() - startTime,
        responseBody: typeof response.data === 'string'
          ? response.data.substring(0, 10000)
          : JSON.stringify(response.data).substring(0, 10000),
        success: response.status === endpoint.expectedStatus,
      };
    } catch (err) {
      replayResult = {
        statusCode: null,
        latencyMs: Date.now() - startTime,
        responseBody: null,
        success: false,
        error: err.message,
      };
    }

    // Build diff
    const diff = {
      statusCodeChanged: lastFailed.statusCode !== replayResult.statusCode,
      oldStatusCode: lastFailed.statusCode,
      newStatusCode: replayResult.statusCode,
      latencyDelta: replayResult.latencyMs - (lastFailed.latencyMs || 0),
      oldLatency: lastFailed.latencyMs,
      newLatency: replayResult.latencyMs,
      isResolved: replayResult.success,
      originalTimestamp: lastFailed.timestamp,
    };

    res.json({
      original: {
        statusCode: lastFailed.statusCode,
        latencyMs: lastFailed.latencyMs,
        error: lastFailed.error,
        timestamp: lastFailed.timestamp,
      },
      replay: replayResult,
      diff,
    });
  } catch (err) {
    console.error('Replay error:', err);
    res.status(500).json({ error: 'Server error during replay.' });
  }
});

module.exports = router;
