const { supabase } = require('../services/supabase');

/**
 * Create an escalation for Steven's attention.
 */
async function createEscalation(title, description, severity, sourceTask = null) {
  try {
    const { data, error } = await supabase
      .from('barry_escalations')
      .insert({
        title,
        description,
        severity,
        source_task: sourceTask,
        acknowledged: false,
        resolved: false
      })
      .select()
      .single();

    if (error) {
      console.error('🚨 [Barry] Escalation creation error:', error);
      return {
        success: false,
        error: error.message,
        title
      };
    }

    console.log(`🚨 [Barry] Escalation created: [${severity.toUpperCase()}] ${title}`);

    return {
      success: true,
      id: data.id,
      title,
      severity,
      created_at: data.created_at
    };
  } catch (err) {
    console.error('🚨 [Barry] Escalation creation exception:', err);
    return {
      success: false,
      error: err.message,
      title
    };
  }
}

module.exports = { createEscalation };
