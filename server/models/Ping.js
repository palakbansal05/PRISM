const mongoose = require('mongoose');

const pingSchema = new mongoose.Schema({
  endpointId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Endpoint',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  statusCode: {
    type: Number,
    default: null,
  },
  latencyMs: {
    type: Number,
    default: null,
  },
  responseBody: {
    type: String,
    default: null,
  },
  responseHeaders: {
    type: Object,
    default: null,
  },
  success: {
    type: Boolean,
    required: true,
  },
  error: {
    type: String,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound indexes for fast time-series queries
pingSchema.index({ endpointId: 1, timestamp: -1 });
pingSchema.index({ userId: 1, success: 1, timestamp: -1 });
pingSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Ping', pingSchema);
