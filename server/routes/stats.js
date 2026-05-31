const express = require('express');
const Ping = require('../models/Ping');
const Endpoint = require('../models/Endpoint');
const Incident = require('../models/Incident');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

/**
 * GET /api/stats
 * Returns dashboard summary for the logged-in user:
 * - totalEndpoints
 * - overallUptimePercent
 * - activeIncidentsCount
 * - avgLatency (p50 / median of last 24h pings)
 */
router.get('/', async (req, res) => {
  try {
    const endpoints = await Endpoint.find({ userId: req.userId });
    const totalEndpoints = endpoints.length;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get all pings for this user in the last 24h
    const recentPings = await Ping.find({
      userId: req.userId,
      timestamp: { $gte: twentyFourHoursAgo },
    }).sort({ timestamp: -1 });

    // Overall uptime %
    const totalPings = recentPings.length;
    const successPings = recentPings.filter((p) => p.success).length;
    const overallUptimePercent = totalPings > 0 ? ((successPings / totalPings) * 100).toFixed(2) : 100;

    // Active incidents: count ACTIVE incidents from the Incident model
    const activeIncidentsCount = await Incident.countDocuments({
      userId: req.userId,
      status: 'ACTIVE',
    });

    // P50 (median) latency from last 24h
    const latencies = recentPings
      .filter((p) => p.latencyMs !== null)
      .map((p) => p.latencyMs)
      .sort((a, b) => a - b);

    let avgLatency = 0;
    if (latencies.length > 0) {
      const mid = Math.floor(latencies.length / 2);
      avgLatency =
        latencies.length % 2 !== 0
          ? latencies[mid]
          : (latencies[mid - 1] + latencies[mid]) / 2;
    }

    res.json({
      totalEndpoints,
      overallUptimePercent: parseFloat(overallUptimePercent),
      activeIncidentsCount,
      avgLatency: Math.round(avgLatency),
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * GET /api/stats/latency/:endpointId
 * Returns p50, p95, p99 latency data points over time for charting
 * Query param: range = 24h | 7d | 30d
 */
router.get('/latency/:endpointId', async (req, res) => {
  try {
    const { endpointId } = req.params;
    const range = req.query.range || '24h';

    // Verify ownership
    const endpoint = await Endpoint.findOne({ _id: endpointId, userId: req.userId });
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found.' });
    }

    let hoursBack = 24;
    if (range === '7d') hoursBack = 7 * 24;
    if (range === '30d') hoursBack = 30 * 24;

    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const pings = await Ping.find({
      endpointId,
      timestamp: { $gte: since },
      latencyMs: { $ne: null },
    }).sort({ timestamp: 1 });

    // Group pings into time buckets for charting
    const bucketCount = Math.min(pings.length, 50);
    if (bucketCount === 0) {
      return res.json({ dataPoints: [] });
    }

    const bucketSize = Math.ceil(pings.length / bucketCount);
    const dataPoints = [];

    for (let i = 0; i < pings.length; i += bucketSize) {
      const bucket = pings.slice(i, i + bucketSize);
      const latencies = bucket.map((p) => p.latencyMs).sort((a, b) => a - b);
      const len = latencies.length;

      dataPoints.push({
        timestamp: bucket[Math.floor(len / 2)].timestamp,
        p50: latencies[Math.floor(len * 0.5)] || 0,
        p95: latencies[Math.floor(len * 0.95)] || latencies[len - 1] || 0,
        p99: latencies[Math.floor(len * 0.99)] || latencies[len - 1] || 0,
      });
    }

    res.json({ dataPoints });
  } catch (err) {
    console.error('Latency stats error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * GET /api/stats/uptime-history/:endpointId
 * Returns 90-day uptime data for the minibar visualization
 * Returns 12 data points sampled from the last 90 days
 */
router.get('/uptime-history/:endpointId', async (req, res) => {
  try {
    const { endpointId } = req.params;

    const endpoint = await Endpoint.findOne({ _id: endpointId, userId: req.userId });
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found.' });
    }

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const buckets = [];
    const bucketDuration = (90 * 24 * 60 * 60 * 1000) / 12; // ~7.5 days per bucket

    for (let i = 0; i < 12; i++) {
      const start = new Date(ninetyDaysAgo.getTime() + i * bucketDuration);
      const end = new Date(start.getTime() + bucketDuration);

      const pings = await Ping.find({
        endpointId,
        timestamp: { $gte: start, $lt: end },
      });

      const total = pings.length;
      const successes = pings.filter((p) => p.success).length;
      const slowCount = pings.filter((p) => p.latencyMs > 1000).length;

      let status = 'empty'; // no data
      if (total > 0) {
        const uptimeRatio = successes / total;
        const slowRatio = slowCount / total;
        if (uptimeRatio < 0.95) status = 'down';
        else if (slowRatio > 0.3) status = 'slow';
        else status = 'up';
      }

      buckets.push({ start, end, status, total, successes });
    }

    res.json({ buckets });
  } catch (err) {
    console.error('Uptime history error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
