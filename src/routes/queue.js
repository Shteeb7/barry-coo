const express = require('express');
const { supabase } = require('../services/supabase');
const { validateAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /queue
 * Fetch queue items with optional filtering
 * Query params:
 *   - status: filter by status (pending/in_progress/completed/failed/cancelled)
 *   - target_mode: filter by target mode (railway/cowork)
 *   - limit: max items to return (default: 50)
 */
router.get('/', validateAuth, async (req, res) => {
  try {
    const {
      status,
      target_mode,
      limit = 50
    } = req.query;

    let query = supabase
      .from('barry_queue')
      .select('*');

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (target_mode) {
      query = query.eq('target_mode', target_mode);
    }

    // Fetch data
    const { data, error } = await query;

    if (error) {
      console.error('🎩 [Queue] Error fetching queue:', error);
      return res.status(500).json({ error: error.message });
    }

    // Sort by priority then queued_at
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const sortedData = (data || []).sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.queued_at) - new Date(b.queued_at);
    });

    // Apply limit
    const limitedData = sortedData.slice(0, parseInt(limit));

    res.json({
      queue: limitedData,
      count: limitedData.length,
      filters: { status, target_mode, limit }
    });

  } catch (err) {
    console.error('🎩 [Queue] Exception:', err);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

module.exports = router;
