const { supabase } = require('../services/supabase');

/**
 * Update notification settings for the user
 * Called when Steven asks Barry to change notification preferences
 */
async function updateNotificationSettings(updates) {
  try {
    // Use the default Steven email (single-user system)
    const userEmail = process.env.ALLOWED_EMAILS?.split(',')[0]?.trim() || 'steven.labrum@gmail.com';

    // Filter out undefined values
    const filteredUpdates = {};
    const allowedFields = [
      'email_enabled',
      'digest_enabled',
      'digest_time',
      'immediate_severities',
      'quiet_hours_start',
      'quiet_hours_end'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return {
        success: false,
        error: 'No valid fields provided for update'
      };
    }

    filteredUpdates.updated_at = new Date().toISOString();

    // Upsert settings
    const { data, error } = await supabase
      .from('barry_notification_settings')
      .upsert({
        user_email: userEmail,
        ...filteredUpdates
      }, {
        onConflict: 'user_email'
      })
      .select()
      .single();

    if (error) {
      console.error('📧 [Barry] Error updating notification settings:', error);
      return {
        success: false,
        error: error.message
      };
    }

    const updatedFields = Object.keys(filteredUpdates).filter(k => k !== 'updated_at');
    console.log(`📧 [Barry] Notification settings updated:`, updatedFields);

    return {
      success: true,
      updated_fields: updatedFields,
      current_settings: {
        email_enabled: data.email_enabled,
        digest_enabled: data.digest_enabled,
        digest_time: data.digest_time,
        immediate_severities: data.immediate_severities,
        quiet_hours_start: data.quiet_hours_start,
        quiet_hours_end: data.quiet_hours_end
      },
      message: `Updated ${updatedFields.join(', ')}`
    };
  } catch (error) {
    console.error('📧 [Barry] Error in updateNotificationSettings:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { updateNotificationSettings };
