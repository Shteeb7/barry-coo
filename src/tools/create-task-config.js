const cron = require('node-cron');
const { supabase } = require('../services/supabase');
const { loadAndRegisterTasks } = require('../services/scheduler');

/**
 * Create a new scheduled task configuration
 */
async function createTaskConfig(
  taskName,
  description,
  cronSchedule,
  promptTemplate,
  model = 'claude-sonnet-4-5-20250929',
  enabled = true
) {
  try {
    // Validate task_name (alphanumeric + underscores only)
    if (!/^[a-z0-9_]+$/.test(taskName)) {
      return {
        success: false,
        error: 'Task name must be lowercase alphanumeric with underscores only (e.g., daily_stuck_check)'
      };
    }

    // Validate cron schedule
    if (!cron.validate(cronSchedule)) {
      return {
        success: false,
        error: `Invalid cron schedule: ${cronSchedule}. Must be a valid cron expression (e.g., "0 13 * * *")`
      };
    }

    // Check if task already exists
    const { data: existing } = await supabase
      .from('barry_task_configs')
      .select('task_name')
      .eq('task_name', taskName)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: `Task "${taskName}" already exists. Use update_task_config to modify it.`
      };
    }

    // Insert task config
    const { data, error } = await supabase
      .from('barry_task_configs')
      .insert({
        task_name: taskName,
        description,
        cron_schedule: cronSchedule,
        prompt_template: promptTemplate,
        model,
        enabled,
        max_retries: 3,
        consecutive_failures: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('⏰ [Barry] Error creating task config:', error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log(`⏰ [Barry] Created task config: ${taskName} (schedule: ${cronSchedule})`);

    // Reload scheduler to pick up new task immediately
    try {
      await loadAndRegisterTasks();
      console.log(`⏰ [Barry] Scheduler reloaded with new task: ${taskName}`);
    } catch (reloadError) {
      console.error('⏰ [Barry] Failed to reload scheduler:', reloadError);
      // Don't fail the task creation if scheduler reload fails
      // The periodic reload will pick it up within 5 minutes
    }

    return {
      success: true,
      task_id: data.id,
      task_name: taskName,
      schedule: cronSchedule,
      message: 'Task created and scheduled'
    };
  } catch (error) {
    console.error('⏰ [Barry] Error creating task config:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { createTaskConfig };
