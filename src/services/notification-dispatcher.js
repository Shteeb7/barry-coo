const { sendEmail } = require('./email-service');
const { supabase } = require('./supabase');
const { renderEscalation } = require('../templates/escalation');
const { renderDailyDigest } = require('../templates/daily-digest');
const { renderTaskFailure } = require('../templates/task-failure');

const NOTIFICATION_RULES = {
  // Escalations
  escalation_critical: { email: 'immediate' },
  escalation_high: { email: 'immediate' },
  escalation_medium: { email: 'digest' },
  escalation_low: { email: 'digest' },

  // Reports
  report_critical: { email: 'immediate' },
  report_warning: { email: 'digest' },
  report_info: { email: 'none' },

  // Task failures
  task_failed: { email: 'immediate' },
  task_permanently_failed: { email: 'immediate' }
};

/**
 * Get notification settings from database
 */
async function getNotificationSettings() {
  const { data, error } = await supabase
    .from('barry_notification_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('📧 [Dispatcher] Error fetching notification settings:', error);
  }

  // Return defaults if no settings found
  return data || {
    email_enabled: true,
    digest_enabled: true,
    digest_time: '14:00',
    immediate_severities: ['critical', 'high'],
    quiet_hours_start: null,
    quiet_hours_end: null
  };
}

/**
 * Check if current time is within quiet hours
 */
function isQuietHours(settings) {
  if (!settings.quiet_hours_start || !settings.quiet_hours_end) {
    return false;
  }

  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  const currentTime = currentHour * 60 + currentMinute; // Minutes since midnight UTC

  const [startHour, startMin] = settings.quiet_hours_start.split(':').map(Number);
  const [endHour, endMin] = settings.quiet_hours_end.split(':').map(Number);
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  // Handle overnight quiet hours (e.g., 22:00 to 06:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime;
  }

  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * Check if an immediate notification should be sent
 */
async function shouldSendImmediate(severity) {
  const settings = await getNotificationSettings();

  if (!settings.email_enabled) {
    return false;
  }

  if (!settings.immediate_severities.includes(severity)) {
    return false;
  }

  if (isQuietHours(settings)) {
    console.log(`📧 [Dispatcher] Quiet hours active - downgrading ${severity} to digest`);
    return false;
  }

  return true;
}

/**
 * Notify about an escalation
 */
async function notifyEscalation(escalation) {
  try {
    const { severity } = escalation;
    const rule = NOTIFICATION_RULES[`escalation_${severity}`];

    if (!rule || rule.email === 'none') {
      console.log(`📧 [Dispatcher] No notification for escalation "${escalation.title}" (${severity})`);
      return { success: true, action: 'none' };
    }

    if (rule.email === 'immediate') {
      const sendNow = await shouldSendImmediate(severity);

      if (sendNow) {
        const { subject, html, text } = renderEscalation(escalation);
        const result = await sendEmail({ subject, html, text });
        console.log(`📧 [Dispatcher] Notification dispatched: escalation "${escalation.title}" (${severity}) → immediate email`);
        return { success: true, action: 'immediate', emailResult: result };
      } else {
        console.log(`📧 [Dispatcher] Notification dispatched: escalation "${escalation.title}" (${severity}) → digest (quiet hours or disabled)`);
        return { success: true, action: 'digest' };
      }
    }

    if (rule.email === 'digest') {
      console.log(`📧 [Dispatcher] Notification dispatched: escalation "${escalation.title}" (${severity}) → digest`);
      return { success: true, action: 'digest' };
    }

    return { success: true, action: 'none' };
  } catch (error) {
    console.error('📧 [Dispatcher] Error in notifyEscalation:', error);
    // Never throw - notification failures shouldn't break core operations
    return { success: false, error: error.message };
  }
}

/**
 * Notify about a report
 */
async function notifyReport(report) {
  try {
    // Extract severity from metadata or default to 'info'
    const severity = report.metadata?.severity || 'info';
    const rule = NOTIFICATION_RULES[`report_${severity}`];

    if (!rule || rule.email === 'none') {
      console.log(`📧 [Dispatcher] No notification for report "${report.report_type}" (${severity})`);
      return { success: true, action: 'none' };
    }

    if (rule.email === 'immediate') {
      const sendNow = await shouldSendImmediate(severity);

      if (sendNow) {
        // For critical reports, we can send them as escalation-style emails
        const escalationData = {
          title: `Critical Report: ${report.report_type}`,
          description: report.summary || report.content.substring(0, 500),
          severity: 'critical',
          source_task: report.report_type,
          created_at: report.created_at
        };

        const { subject, html, text } = renderEscalation(escalationData);
        const result = await sendEmail({ subject, html, text });
        console.log(`📧 [Dispatcher] Notification dispatched: report "${report.report_type}" (${severity}) → immediate email`);
        return { success: true, action: 'immediate', emailResult: result };
      } else {
        console.log(`📧 [Dispatcher] Notification dispatched: report "${report.report_type}" (${severity}) → digest`);
        return { success: true, action: 'digest' };
      }
    }

    if (rule.email === 'digest') {
      console.log(`📧 [Dispatcher] Notification dispatched: report "${report.report_type}" (${severity}) → digest`);
      return { success: true, action: 'digest' };
    }

    return { success: true, action: 'none' };
  } catch (error) {
    console.error('📧 [Dispatcher] Error in notifyReport:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify about a task failure
 */
async function notifyTaskFailure(taskName, error, retryCount, maxRetries) {
  try {
    const isPermanent = retryCount >= maxRetries;
    const { subject, html, text } = renderTaskFailure({
      taskName,
      error: error.message || error,
      retryCount,
      maxRetries,
      failedAt: new Date().toISOString(),
      isPermanent
    });

    const result = await sendEmail({ subject, html, text });
    console.log(`📧 [Dispatcher] Task failure notification sent: "${taskName}" (${retryCount}/${maxRetries})`);
    return { success: true, emailResult: result };
  } catch (err) {
    console.error('📧 [Dispatcher] Error in notifyTaskFailure:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send daily digest email
 */
async function sendDailyDigest() {
  try {
    console.log('📧 [Dispatcher] Generating daily digest...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch today's reports
    const { data: reports } = await supabase
      .from('barry_reports')
      .select('*')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });

    // Fetch all escalations (focus on unacknowledged/unresolved)
    const { data: escalations } = await supabase
      .from('barry_escalations')
      .select('*')
      .order('created_at', { ascending: false });

    // Fetch queue status
    const { data: pendingQueue } = await supabase
      .from('barry_queue')
      .select('id')
      .eq('status', 'pending');

    const { data: completedToday } = await supabase
      .from('barry_queue')
      .select('id')
      .eq('status', 'completed')
      .gte('updated_at', today.toISOString());

    // Fetch system health (stuck stories)
    const { data: stuckStories } = await supabase
      .from('stories')
      .select('id')
      .in('generation_progress->current_step', ['generating_bible', 'generating_arc', 'generating_chapter']);

    const digestData = {
      date: today.toLocaleDateString('en-US', { dateStyle: 'long' }),
      reports: reports || [],
      escalations: escalations || [],
      queueStatus: {
        pending: pendingQueue?.length || 0,
        completed: completedToday?.length || 0
      },
      systemHealth: {
        summary: stuckStories?.length > 0
          ? `${stuckStories.length} stories stuck in generation - check health dashboard`
          : 'All systems operational.',
        stuckStories: stuckStories?.length || 0
      }
    };

    const { subject, html, text } = renderDailyDigest(digestData);
    const result = await sendEmail({ subject, html, text });

    console.log(`📧 [Dispatcher] Daily digest sent successfully`);
    return { success: true, emailResult: result };
  } catch (error) {
    console.error('📧 [Dispatcher] Error sending daily digest:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  notifyEscalation,
  notifyReport,
  notifyTaskFailure,
  sendDailyDigest,
  getNotificationSettings
};
