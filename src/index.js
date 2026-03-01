require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { startScheduler, stopScheduler } = require('./services/scheduler');

// Import routes
const healthRouter = require('./routes/health');
const reportsRouter = require('./routes/reports');
const escalationsRouter = require('./routes/escalations');
const queueRouter = require('./routes/queue');
const chatRouter = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Static files (for chat UI)
app.use(express.static('public'));

// Routes
app.use('/health', healthRouter);
app.use('/reports', reportsRouter);
app.use('/escalations', escalationsRouter);
app.use('/queue', queueRouter);
app.use('/chat', chatRouter);

// Start server
const server = app.listen(PORT, async () => {
  console.log(`🎩 Barry COO online on port ${PORT}. Thorne would be proud.`);

  // Start scheduler
  try {
    await startScheduler();
  } catch (error) {
    console.error('🎩 Failed to start scheduler:', error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🎩 SIGTERM received. Shutting down gracefully...');
  stopScheduler();
  server.close(() => {
    console.log('🎩 Server closed. Goodbye, meatbag.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🎩 SIGINT received. Shutting down gracefully...');
  stopScheduler();
  server.close(() => {
    console.log('🎩 Server closed. Goodbye, meatbag.');
    process.exit(0);
  });
});

module.exports = app;
