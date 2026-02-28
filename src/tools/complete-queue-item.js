const { supabase } = require('../services/supabase');

/**
 * Mark a queue item as completed or failed.
 * Used by Cowork-Barry when finishing a queued task.
 */
async function completeQueueItem(queueId, status, resultSummary = null, resultDetail = null, errorMessage = null) {
  try {
    // Validate status
    if (status !== 'completed' && status !== 'failed') {
      return {
        success: false,
        error: "Status must be 'completed' or 'failed'",
        queue_id: queueId
      };
    }

    const updateData = {
      status,
      completed_at: new Date().toISOString(),
      result_summary: resultSummary,
      result_detail: resultDetail
    };

    if (status === 'failed' && errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { data, error } = await supabase
      .from('barry_queue')
      .update(updateData)
      .eq('id', queueId)
      .select()
      .single();

    if (error) {
      console.error('📬 [Barry] Complete queue item error:', error);
      return {
        success: false,
        error: error.message,
        queue_id: queueId
      };
    }

    console.log(`📬 [Barry] Queue item ${status}: ${data.request_summary}`);

    return {
      success: true,
      queue_id: queueId,
      status,
      completed_at: data.completed_at,
      message: `Queue item marked as ${status}`
    };
  } catch (err) {
    console.error('📬 [Barry] Complete queue item exception:', err);
    return {
      success: false,
      error: err.message,
      queue_id: queueId
    };
  }
}

module.exports = { completeQueueItem };
