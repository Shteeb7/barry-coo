const cron = require('node-cron');
const { supabase } = require('../services/supabase');
const { loadAndRegisterTasks } = require('../services/scheduler');

/**
 * Update an existing scheduled task configuration
 */
async function updateTaskConfig(
  taskName,
  cronSchedule,
  promptTemplate,
  enabled,
  model,
  description
) {
  try {
    // Fetch existing task
    const { data: existingTask, error: fetchError } = await supabase
      .from('barry_task_configs')
      .select('*')
      .eq('task_name', taskName)
      .maybeSingle();

    if (fetchError) {
      console.error('⏰ [Barry] Error fetching task config:', fetchError);
      return {
        success: false,
        error: fetchError.message
      };
    }

    if (!existingTask) {
      return {
        success: false,
        error: `Task "${taskName}" not found. Use create_task_config to create a new task.`
      };
    }

    // Build updates object with only provided fields
    const updates = {
      updated_at: new Date().toISOString()
    };

    const updatedFields = [];

    if (cronSchedule !== undefined) {
      // Validate cron schedule
      if (!cron.validate(cronSchedule)) {
        return {
          success: false,
          error: `Invalid cron schedule: ${cronSchedule}. Must be a valid cron expression (e.g., "0 13 * * *")`
        };
      }
      updates.cron_schedule = cronSchedule;
      updatedFields.push('cron_schedule');
    }

    if (promptTemplate !== undefined) {
      updates.prompt_template = promptTemplate;
      updatedFields.push('prompt_template');
    }

    if (model !== undefined) {
      updates.model = model;
      updatedFields.push('model');
    }

    if (enabled !== undefined) {
      updates.enabled = enabled;
      updatedFields.push('enabled');
    }

    if (description !== undefined) {
      updates.description = description;
      updatedFields.push('description');
    }

    // If no updates provided, return early
    if (updatedFields.length === 0) {
      return {
        success: false,
        error: 'No updates provided. Specify at least one field to update.'
      };
    }

    // Perform update
    const { data, error: updateError } = await supabase
      .from('barry_task_configs')
      .update(updates)
      .eq('task_name', taskName)
      .select()
      .single();

    if (updateError) {
      console.error('⏰ [Barry] Error updating task config:', updateError);
      return {
        success: false,
        error: updateError.message
      };
    }

    console.log(`⏰ [Barry] Updated task config: ${taskName} (fields: ${updatedFields.join(', ')})`);

    // Reload scheduler to pick up changes immediately
    try {
      await loadAndRegisterTasks();
      console.log(`⏰ [Barry] Scheduler reloaded with updated task: ${taskName}`);
    } catch (reloadError) {
      console.error('⏰ [Barry] Failed to reload scheduler:', reloadError);
      // Don't fail the update if scheduler reload fails
      // The periodic reload will pick it up within 5 minutes
    }

    return {
      success: true,
      task_id: data.id,
      task_name: taskName,
      updated_fields: updatedFields,
      message: 'Task updated and scheduler reloaded'
    };
  } catch (error) {
    console.error('⏰ [Barry] Error updating task config:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { updateTaskConfig };
