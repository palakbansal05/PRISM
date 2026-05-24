require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const endpointRoutes = require('./routes/endpoints');
const statsRoutes = require('./routes/stats');
const incidentRoutes = require('./routes/incidents');
const scheduler = require('./scheduler');
const mailer = require('./utils/mailer');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// --------------- Socket.IO ---------------
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
});

// Make io globally accessible for the scheduler
global.io = io;

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// --------------- Middleware ---------------
app.use(cors());
app.use(express.json());

// --------------- Routes ---------------
app.use('/api/auth', authRoutes);
app.use('/api/endpoints', endpointRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/incidents', incidentRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --------------- Global Error Handler ---------------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// --------------- Start Server ---------------
async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Initialize email alerts
    mailer.init();

    // Start the scheduler worker thread
    scheduler.start();

    // Use server.listen instead of app.listen for Socket.IO
    server.listen(PORT, () => {
      console.log(`🚀 PRISM server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
