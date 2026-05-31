const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  endpointId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Endpoint',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'RESOLVED'],
    default: 'ACTIVE',
    index: true,
  },
  reason: {
    type: String,
    default: 'Unknown',
  },
  statusCodeReceived: {
    type: Number,
    default: null,
  },
  startedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
  failureCount: {
    type: Number,
    default: 1,
  },
  lastCheckedAt: {
    type: Date,
    default: Date.now,
  },
});

// Fast queries for active incidents per user
incidentSchema.index({ userId: 1, status: 1 });
incidentSchema.index({ endpointId: 1, status: 1 });

module.exports = mongoose.model('Incident', incidentSchema);
