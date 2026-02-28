const express = require('express');
const { supabase } = require('../services/supabase');
const { validateAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /escalations
 * Fetch Barry's escalations
 * Query params:
 *   - resolved: filter by resolved status (true/false, default: false)
 *   - severity: filter by severity (info/warning/critical)
 */
router.get('/', validateAuth, async (req, res) => {
  try {
    const {
      resolved = 'false',
      severity
    } = req.query;

    // Build query
    let query = supabase
      .from('barry_escalations')
      .select('*')
      .eq('resolved', resolved === 'true')
      .order('created_at', { ascending: false });

    // Apply severity filter
    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query;

    if (error) {
      console.error('🎩 [Escalations] Error fetching escalations:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      escalations: data,
      count: data.length,
      filters: { resolved, severity }
    });

  } catch (err) {
    console.error('🎩 [Escalations] Exception:', err);
    res.status(500).json({ error: 'Failed to fetch escalations' });
  }
});

module.exports = router;
