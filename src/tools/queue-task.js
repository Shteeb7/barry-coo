const { supabase } = require('../services/supabase');

/**
 * Queue a task for Barry's other mode (Railway <-> Cowork handoff).
 */
async function queueTask(requestSummary, fullContext = null, requiredTools = [], priority = 'P2', targetMode = 'cowork') {
  try {
    const { data, error } = await supabase
      .from('barry_queue')
      .insert({
        request_summary: requestSummary,
        full_context: fullContext,
        required_tools: requiredTools,
        priority,
        queued_by: 'railway', // Always 'railway' since this tool runs on Railway
        target_mode: targetMode,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('📬 [Barry] Queue task error:', error);
      return {
        success: false,
        error: error.message,
        request_summary: requestSummary
      };
    }

    console.log(`📬 [Barry] Task queued for ${targetMode}: ${requestSummary} [${priority}]`);

    return {
      success: true,
      queue_id: data.id,
      request_summary: requestSummary,
      target_mode: targetMode,
      priority,
      queued_at: data.queued_at,
      message: `Task queued for ${targetMode} mode (${priority} priority)`
    };
  } catch (err) {
    console.error('📬 [Barry] Queue task exception:', err);
    return {
      success: false,
      error: err.message,
      request_summary: requestSummary
    };
  }
}

module.exports = { queueTask };
