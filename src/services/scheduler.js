const cron = require('node-cron');
const { supabase } = require('./supabase');
const { callBarry } = require('./brain');
const { notifyReport, notifyTaskFailure, sendDailyDigest } = require('./notification-dispatcher');

// Map of active cron jobs: taskName -> cron job instance
const activeCronJobs = new Map();

/**
 * Check if a report already exists for this task today (deduplication)
 */
async function reportExistsToday(taskName) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('barry_reports')
    .select('id')
    .eq('task_name', taskName)
    .gte('created_at', todayStart.toISOString())
    .limit(1);

  if (error) {
    console.error('📋 [Scheduler] Error checking for existing report:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Get the last report for a task (for trend comparison)
 */
async function getLastReport(taskName) {
  const { data, error } = await supabase
    .from('barry_reports')
    .select('report_content, created_at')
    .eq('task_name', taskName)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('📋 [Scheduler] Error fetching last report:', error);
    return null;
  }

  return data;
}

/**
 * Execute a scheduled task
 */
async function executeTask(taskConfig) {
  const { task_name, prompt_template, model, max_retries, consecutive_failures } = taskConfig;

  console.log(`📋 [Scheduler] Executing task: ${task_name}`);

  // Special handling for daily digest email task
  if (task_name === 'daily_digest_email') {
    try {
      await sendDailyDigest();
      await supabase
        .from('barry_task_configs')
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: 'success',
          updated_at: new Date().toISOString()
        })
        .eq('task_name', task_name);
      return;
    } catch (error) {
      console.error(`📧 [Scheduler] Daily digest failed:`, error);
      await supabase
        .from('barry_task_configs')
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: 'error',
          last_error: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('task_name', task_name);
      return;
    }
  }

  // Check if task has hit max retries
  if (consecutive_failures >= max_retries) {
    console.log(`🛑 [Scheduler] Task ${task_name} has hit max retries (${max_retries}). Skipping.`);

    // Update last run status
    await supabase
      .from('barry_task_configs')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: 'skipped',
        updated_at: new Date().toISOString()
      })
      .eq('task_name', task_name);

    return;
  }

  // Check for duplicate report today (deduplication)
  const isDuplicate = await reportExistsToday(task_name);
  if (isDuplicate) {
    console.log(`📋 [Scheduler] Report already exists for ${task_name} today. Skipping.`);
    return;
  }

  try {
    // Get last report for trend comparison
    const lastReport = await getLastReport(task_name);

    // Build task context
    let taskContext = `Current Date: ${new Date().toISOString()}\n`;
    if (lastReport) {
      taskContext += `\nLast Report (${new Date(lastReport.created_at).toLocaleDateString()}):\n${lastReport.report_content}\n`;
    }

    // Call Barry's brain
    const result = await callBarry({
      prompt: prompt_template,
      taskName: task_name,
      model,
      taskContext
    });

    // Extract summary (first 2 sentences or first 200 chars)
    const sentences = result.content.split(/[.!?]\s+/);
    const summary = sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '.' : '');

    // Determine severity based on content keywords
    let severity = 'info';
    const contentLower = result.content.toLowerCase();
    if (contentLower.includes('critical') || contentLower.includes('urgent') || contentLower.includes('error')) {
      severity = 'critical';
    } else if (contentLower.includes('warning') || contentLower.includes('attention') || contentLower.includes('anomaly')) {
      severity = 'warning';
    }

    // Write report to database
    const { data: reportData, error: reportError } = await supabase
      .from('barry_reports')
      .insert({
        task_name,
        report_content: result.content,
        summary: summary.substring(0, 500), // Limit summary length
        severity,
        model_used: result.model,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        cost_estimate: result.cost,
        acknowledged: false
      })
      .select()
      .single();

    if (reportError) {
      throw new Error(`Failed to write report: ${reportError.message}`);
    }

    console.log(`📋 [Scheduler] Task ${task_name} completed successfully. Severity: ${severity}`);

    // Send notification for the report (wrapped to never break core operation)
    try {
      await notifyReport(reportData);
    } catch (notifyError) {
      console.error('📋 [Scheduler] Notification failed (report still saved):', notifyError);
    }

    // Update task config: success
    await supabase
      .from('barry_task_configs')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: 'success',
        last_error: null,
        consecutive_failures: 0,
        updated_at: new Date().toISOString()
      })
      .eq('task_name', task_name);

  } catch (error) {
    console.error(`❌ [Scheduler] Task ${task_name} failed:`, error);

    const newFailureCount = consecutive_failures + 1;

    // Update task config: error
    await supabase
      .from('barry_task_configs')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: 'error',
        last_error: error.message,
        consecutive_failures: newFailureCount,
        updated_at: new Date().toISOString()
      })
      .eq('task_name', task_name);

    // Send task failure notification (wrapped to never break error handling)
    try {
      await notifyTaskFailure(task_name, error, newFailureCount, max_retries);
    } catch (notifyError) {
      console.error('📋 [Scheduler] Notification failed (task error still logged):', notifyError);
    }

    // If hit max retries, disable task and create critical escalation
    if (newFailureCount >= max_retries) {
      console.error(`🛑 [Scheduler] Task ${task_name} hit max retries (${max_retries}). Disabling task.`);

      await supabase
        .from('barry_task_configs')
        .update({
          enabled: false,
          updated_at: new Date().toISOString()
        })
        .eq('task_name', task_name);

      // Create critical escalation
      await supabase
        .from('barry_escalations')
        .insert({
          title: `Scheduled task disabled: ${task_name}`,
          description: `The scheduled task "${task_name}" has failed ${max_retries} times consecutively and has been automatically disabled.\n\nLast error: ${error.message}\n\nThis requires investigation and manual re-enable after the issue is resolved.`,
          severity: 'critical',
          source_task: task_name,
          acknowledged: false,
          resolved: false
        });

      console.log(`🚨 [Scheduler] Critical escalation created for disabled task: ${task_name}`);
    }
  }
}

/**
 * Load task configs from database and register cron jobs
 */
async function loadAndRegisterTasks() {
  console.log('📋 [Scheduler] Loading task configs from database...');

  const { data: tasks, error } = await supabase
    .from('barry_task_configs')
    .select('*')
    .eq('enabled', true);

  if (error) {
    console.error('📋 [Scheduler] Error loading task configs:', error);
    return;
  }

  console.log(`📋 [Scheduler] Loaded ${tasks.length} enabled task(s)`);

  // Unregister old jobs that are no longer enabled
  for (const [taskName, job] of activeCronJobs.entries()) {
    if (!tasks.find(t => t.task_name === taskName)) {
      console.log(`📋 [Scheduler] Unregistering removed/disabled task: ${taskName}`);
      job.stop();
      activeCronJobs.delete(taskName);
    }
  }

  // Register new/updated jobs
  for (const task of tasks) {
    const { task_name, cron_schedule } = task;

    // If job already exists with same schedule, skip
    if (activeCronJobs.has(task_name)) {
      console.log(`📋 [Scheduler] Task ${task_name} already registered, skipping`);
      continue;
    }

    // Validate cron schedule
    if (!cron.validate(cron_schedule)) {
      console.error(`📋 [Scheduler] Invalid cron schedule for ${task_name}: ${cron_schedule}`);
      continue;
    }

    // Register cron job
    console.log(`📋 [Scheduler] Registering task: ${task_name} (schedule: ${cron_schedule})`);

    const job = cron.schedule(cron_schedule, () => {
      executeTask(task).catch(err => {
        console.error(`📋 [Scheduler] Unhandled error in task ${task_name}:`, err);
      });
    });

    activeCronJobs.set(task_name, job);
  }

  console.log(`📋 [Scheduler] ${activeCronJobs.size} task(s) scheduled`);
}

/**
 * Start the scheduler
 */
async function startScheduler() {
  console.log('📋 [Scheduler] Starting Barry task scheduler...');

  // Initial load
  await loadAndRegisterTasks();

  // Reload task configs every 5 minutes to pick up changes
  setInterval(async () => {
    console.log('📋 [Scheduler] Reloading task configs...');
    await loadAndRegisterTasks();
  }, 5 * 60 * 1000); // 5 minutes

  console.log('📋 [Scheduler] Scheduler started successfully');
}

/**
 * Stop all scheduled tasks (for graceful shutdown)
 */
function stopScheduler() {
  console.log('📋 [Scheduler] Stopping all scheduled tasks...');
  for (const [taskName, job] of activeCronJobs.entries()) {
    job.stop();
    console.log(`📋 [Scheduler] Stopped task: ${taskName}`);
  }
  activeCronJobs.clear();
  console.log('📋 [Scheduler] All tasks stopped');
}

module.exports = { startScheduler, stopScheduler, executeTask, loadAndRegisterTasks };
