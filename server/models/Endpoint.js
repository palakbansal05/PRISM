const mongoose = require('mongoose');

const endpointSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  url: {
    type: String,
    required: true,
    trim: true,
  },
  method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
    default: 'GET',
  },
  expectedStatus: {
    type: Number,
    default: 200,
  },
  intervalSeconds: {
    type: Number,
    default: 60,
    min: 10,
  },
  // ---- Performance & Timeout Config ----
  expectedResponseMs: {
    type: Number,
    default: 5000,   // 5 seconds — if response takes longer, mark DEGRADED
    min: 500,
  },
  timeoutSeconds: {
    type: Number,
    default: 60,     // User-specified timeout (clamped in worker to 60–100s)
    min: 10,
  },
  headers: {
    type: Object,
    default: {},
  },
  body: {
    type: String,
    default: null,
  },
  alertEmail: {
    type: String,
    default: null,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastChecked: {
    type: Date,
    default: null,
  },
  // ---- State Machine Fields ----
  status: {
    type: String,
    enum: ['UP', 'DOWN', 'DEGRADED'],
    default: 'UP',
  },
  consecutiveFailures: {
    type: Number,
    default: 0,
  },
  consecutiveSuccesses: {
    type: Number,
    default: 0,
  },
  currentIncidentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Endpoint', endpointSchema);
