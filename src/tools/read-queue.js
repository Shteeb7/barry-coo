const { supabase } = require('../services/supabase');

/**
 * Read queue items with optional filtering.
 * Orders by priority (P0 first) then by queued_at (oldest first).
 */
async function readQueue(status = null, targetMode = null, limit = 10) {
  try {
    let query = supabase
      .from('barry_queue')
      .select('*');

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (targetMode) {
      query = query.eq('target_mode', targetMode);
    }

    // Order by priority (P0=0, P1=1, P2=2, P3=3) then by queued_at
    // Note: Supabase doesn't support CASE in order(), so we'll sort in JS
    const { data, error } = await query;

    if (error) {
      console.error('📬 [Barry] Read queue error:', error);
      return {
        success: false,
        error: error.message
      };
    }

    // Sort by priority then queued_at
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const sortedData = (data || []).sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.queued_at) - new Date(b.queued_at);
    });

    // Apply limit
    const limitedData = sortedData.slice(0, limit);

    console.log(`📬 [Barry] Read queue: ${limitedData.length} item(s) found`);

    return {
      success: true,
      items: limitedData,
      count: limitedData.length,
      filters: { status, targetMode, limit }
    };
  } catch (err) {
    console.error('📬 [Barry] Read queue exception:', err);
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = { readQueue };
