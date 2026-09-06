const axios = require('axios');
const Incident = require('../models/Incident');
const Endpoint = require('../models/Endpoint');
const Ping = require('../models/Ping');

/**
 * GET /api/incidents
 * Returns the 20 most recent incidents (ACTIVE first, then RESOLVED)
 * for the logged-in user, populated with endpoint info.
 */
const listIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find({ userId: req.userId })
      .sort({ startedAt: -1 })
      .limit(20)
      .populate('endpointId', 'name url method');

    const normalized = incidents.map((incident) => {
      const endpoint = incident.endpointId;
      const endpointSnapshot = endpoint
        ? {
            _id: endpoint._id,
            name: endpoint.name,
            url: endpoint.url,
            method: endpoint.method,
          }
        : {
            _id: null,
            name: incident.endpointName || 'Unknown',
            url: incident.endpointUrl || '',
            method: null,
          };

      return {
        ...incident.toObject(),
        endpointId: endpointSnapshot,
      };
    });

    res.json({ incidents: normalized });
  } catch (err) {
    console.error('Incidents error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

/**
 * POST /api/incidents/replay/:id
 * Re-fire the last failed request for the endpoint live
 * Returns the new result and a diff against the original failure
 */
const replayIncident = async (req, res) => {
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
        validateStatus: () => true,
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
};

module.exports = { listIncidents, replayIncident };
