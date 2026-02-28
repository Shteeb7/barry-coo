const express = require('express');
const { supabase } = require('../services/supabase');
const { validateAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /reports
 * Fetch Barry's reports with optional filtering
 * Query params:
 *   - days: number of days to look back (default: 7)
 *   - task_name: filter by specific task
 *   - severity: filter by severity (info/warning/critical)
 *   - acknowledged: filter by acknowledged status (true/false)
 */
router.get('/', validateAuth, async (req, res) => {
  try {
    const {
      days = 7,
      task_name,
      severity,
      acknowledged
    } = req.query;

    // Calculate date threshold
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    // Build query
    let query = supabase
      .from('barry_reports')
      .select('*')
      .gte('created_at', daysAgo.toISOString())
      .order('created_at', { ascending: false });

    // Apply filters
    if (task_name) {
      query = query.eq('task_name', task_name);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (acknowledged !== undefined) {
      query = query.eq('acknowledged', acknowledged === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('🎩 [Reports] Error fetching reports:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      reports: data,
      count: data.length,
      filters: { days, task_name, severity, acknowledged }
    });

  } catch (err) {
    console.error('🎩 [Reports] Exception:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

module.exports = router;
