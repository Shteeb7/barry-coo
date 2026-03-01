/**
 * CHAT CONTEXT ENRICHMENT
 *
 * Pre-fetches relevant data before starting a chat session so Barry starts informed.
 * Pattern from Prospero's checkpoint context enrichment.
 */

const { supabase } = require('./supabase');

/**
 * Enrich context with relevant data for the conversation type
 * @param {string} userId - User ID
 * @param {string} conversationType - Type of conversation
 * @returns {Object} Enriched context object
 */
async function enrichChatContext(userId, conversationType) {
  const context = {
    userId,
    conversationType,
    timestamp: new Date().toISOString()
  };

  try {
    // ===== ALWAYS FETCH =====

    // Recent memory (preferences and context)
    const { data: memory } = await supabase
      .from('barry_memory')
      .select('*')
      .in('category', ['preference', 'context'])
      .order('updated_at', { ascending: false })
      .limit(20);
    context.recentMemory = memory || [];

    // Open escalations
    const { data: escalations } = await supabase
      .from('barry_escalations')
      .select('id, title, priority, status, created_at')
      .neq('status', 'resolved')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(10);
    context.openEscalations = escalations || [];

    // Pending queue items
    const { data: queue } = await supabase
      .from('barry_queue')
      .select('id, request_summary, priority, target_mode, status, queued_at')
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('queued_at', { ascending: true })
      .limit(10);
    context.pendingQueue = queue || [];

    // Recent reports (last 5)
    const { data: reports } = await supabase
      .from('barry_reports')
      .select('id, report_type, summary, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    context.recentReports = reports || [];

    // ===== CONVERSATION-TYPE-SPECIFIC =====

    if (conversationType === 'status_check') {
      // Story stats by status
      const { data: storyStats } = await supabase
        .rpc('exec_sql', {
          sql_query: "SELECT status, COUNT(*) as count FROM stories GROUP BY status"
        });
      context.storyStats = storyStats?.data || [];

      // Recent chapters (last 24 hours)
      const { data: recentChapters } = await supabase
        .rpc('exec_sql', {
          sql_query: "SELECT COUNT(*) as count FROM chapters WHERE created_at > now() - interval '24 hours'"
        });
      context.recentChapters = recentChapters?.data?.[0]?.count || 0;

      // Stuck stories (in generating states)
      const { data: stuckStories } = await supabase
        .from('stories')
        .select('id, title, generation_progress')
        .or('generation_progress->>current_step.like.generating_%')
        .limit(10);
      context.stuckStories = stuckStories || [];
    }

    if (conversationType === 'escalation_review') {
      // All escalations with full details
      const { data: allEscalations } = await supabase
        .from('barry_escalations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      context.allEscalations = allEscalations || [];
    }

    if (conversationType === 'task_setup') {
      // All task configs
      const { data: taskConfigs } = await supabase
        .from('barry_task_configs')
        .select('*')
        .order('enabled', { ascending: false })
        .order('task_name', { ascending: true });
      context.existingTasks = taskConfigs || [];
    }

    return context;

  } catch (error) {
    console.error('🎩 [Barry] Context enrichment error:', error);
    return context; // Return partial context if some queries fail
  }
}

/**
 * Format context for system prompt
 * @param {Object} context - Enriched context
 * @returns {string} Formatted context string
 */
function formatContext(context) {
  let formatted = '';

  // Memory
  if (context.recentMemory?.length > 0) {
    formatted += '**Recent Memory:**\n';
    context.recentMemory.forEach(m => {
      formatted += `- ${m.key}: ${m.value}\n`;
    });
    formatted += '\n';
  }

  // Open escalations
  if (context.openEscalations?.length > 0) {
    formatted += '**Open Escalations:**\n';
    context.openEscalations.forEach(e => {
      formatted += `- [${e.priority}] ${e.title} (${e.status})\n`;
    });
    formatted += '\n';
  }

  // Pending queue
  if (context.pendingQueue?.length > 0) {
    formatted += '**Pending Queue:**\n';
    context.pendingQueue.forEach(q => {
      formatted += `- [${q.priority}] ${q.request_summary} (${q.target_mode})\n`;
    });
    formatted += '\n';
  }

  // Recent reports
  if (context.recentReports?.length > 0) {
    formatted += '**Recent Reports:**\n';
    context.recentReports.forEach(r => {
      formatted += `- ${r.report_type}: ${r.summary}\n`;
    });
    formatted += '\n';
  }

  // Status check specifics
  if (context.storyStats) {
    formatted += '**Story Stats:**\n';
    context.storyStats.forEach(s => {
      formatted += `- ${s.status}: ${s.count}\n`;
    });
    formatted += '\n';
  }

  if (context.recentChapters !== undefined) {
    formatted += `**Recent Chapters:** ${context.recentChapters} in the last 24 hours\n\n`;
  }

  if (context.stuckStories?.length > 0) {
    formatted += '**Stuck Stories:**\n';
    context.stuckStories.forEach(s => {
      const step = s.generation_progress?.current_step || 'unknown';
      formatted += `- ${s.title} (${step})\n`;
    });
    formatted += '\n';
  }

  // Task setup specifics
  if (context.existingTasks) {
    formatted += '**Existing Tasks:**\n';
    context.existingTasks.forEach(t => {
      const status = t.enabled ? 'enabled' : 'disabled';
      formatted += `- ${t.task_name} (${status}): ${t.cron_schedule}\n`;
    });
    formatted += '\n';
  }

  return formatted || 'No additional context available.';
}

module.exports = {
  enrichChatContext,
  formatContext
};
