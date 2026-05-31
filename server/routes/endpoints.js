const express = require('express');
const Endpoint = require('../models/Endpoint');
const Ping = require('../models/Ping');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes protected by JWT middleware
router.use(auth);

/**
 * GET /api/endpoints
 * List all endpoints for the logged-in user
 */
router.get('/', async (req, res) => {
  try {
    const endpoints = await Endpoint.find({ userId: req.userId }).sort({ createdAt: -1 });

    // Attach latest ping status to each endpoint
    const enriched = await Promise.all(
      endpoints.map(async (ep) => {
        const lastPing = await Ping.findOne({ endpointId: ep._id }).sort({ timestamp: -1 });
        const obj = ep.toObject();
        obj.lastPing = lastPing || null;
        return obj;
      })
    );

    res.json({ endpoints: enriched });
  } catch (err) {
    console.error('List endpoints error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * POST /api/endpoints
 * Create a new monitored endpoint
 */
router.post('/', async (req, res) => {
  try {
    const { name, url, method, expectedStatus, intervalSeconds, headers, body, alertEmail } =
      req.body;

    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required.' });
    }

    if (name.trim().length < 1 || name.trim().length > 100) {
      return res.status(400).json({ error: 'Name must be between 1 and 100 characters.' });
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json({ error: 'URL must start with http:// or https://' });
    }

    if (expectedStatus && (expectedStatus < 100 || expectedStatus > 599)) {
      return res.status(400).json({ error: 'Expected status must be a valid HTTP code (100-599).' });
    }

    if (intervalSeconds && (intervalSeconds < 10 || intervalSeconds > 3600)) {
      return res.status(400).json({ error: 'Interval must be between 10 and 3600 seconds.' });
    }

    if (alertEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(alertEmail)) {
        return res.status(400).json({ error: 'Invalid alert email format.' });
      }
    }

    // Parse headers if it's a string
    let parsedHeaders = headers || {};
    if (typeof headers === 'string') {
      try {
        parsedHeaders = JSON.parse(headers);
      } catch {
        return res.status(400).json({ error: 'Headers must be valid JSON.' });
      }
    }

    const endpoint = new Endpoint({
      userId: req.userId,
      name,
      url,
      method: method || 'GET',
      expectedStatus: expectedStatus || 200,
      intervalSeconds: intervalSeconds || 60,
      headers: parsedHeaders,
      body: body || null,
      alertEmail: alertEmail || null,
    });

    await endpoint.save();

    // Notify scheduler about new endpoint — convert ObjectIds to strings
    // because postMessage serializes them as raw BSON buffers
    if (global.schedulerChannel) {
      const epData = endpoint.toObject();
      epData._id = endpoint._id.toString();
      epData.userId = endpoint.userId.toString();
      global.schedulerChannel.postMessage({ type: 'ADD_ENDPOINT', endpoint: epData });
    }

    res.status(201).json({ endpoint });
  } catch (err) {
    console.error('Create endpoint error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * DELETE /api/endpoints/:id
 * Delete endpoint and all its pings
 */
router.delete('/:id', async (req, res) => {
  try {
    const endpoint = await Endpoint.findOne({ _id: req.params.id, userId: req.userId });
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found.' });
    }

    // Cascade delete all pings
    await Ping.deleteMany({ endpointId: endpoint._id });
    await Endpoint.deleteOne({ _id: endpoint._id });

    // Notify scheduler to stop monitoring
    if (global.schedulerChannel) {
      global.schedulerChannel.postMessage({
        type: 'REMOVE_ENDPOINT',
        endpointId: endpoint._id.toString(),
      });
    }

    res.json({ message: 'Endpoint and its pings deleted.' });
  } catch (err) {
    console.error('Delete endpoint error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * GET /api/endpoints/:id/pings
 * Last 500 pings for an endpoint, sorted by timestamp desc
 */
router.get('/:id/pings', async (req, res) => {
  try {
    // Verify ownership
    const endpoint = await Endpoint.findOne({ _id: req.params.id, userId: req.userId });
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found.' });
    }

    const pings = await Ping.find({ endpointId: req.params.id })
      .sort({ timestamp: -1 })
      .limit(500);

    res.json({ pings });
  } catch (err) {
    console.error('Get pings error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
