const express = require('express');
const router = express.Router();

/**
 * GET /health
 * Basic health check endpoint for Railway
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'barry-coo',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;
