const express = require('express');
const { validateAuth } = require('../middleware/auth');
const { supabase } = require('../services/supabase');

const router = express.Router();

/**
 * GET /notifications/settings
 * Get current notification preferences
 */
router.get('/settings', validateAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;

    const { data, error } = await supabase
      .from('barry_notification_settings')
      .select('*')
      .eq('user_email', userEmail)
      .maybeSingle();

    if (error) {
      console.error('📧 [Notifications] Error fetching settings:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    // Return defaults if no settings found
    const settings = data || {
      user_email: userEmail,
      email_enabled: true,
      digest_enabled: true,
      digest_time: '14:00',
      immediate_severities: ['critical', 'high'],
      quiet_hours_start: null,
      quiet_hours_end: null
    };

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('📧 [Notifications] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /notifications/settings
 * Update notification preferences
 */
router.put('/settings', validateAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const updates = req.body;

    // Validate update fields
    const allowedFields = [
      'email_enabled',
      'digest_enabled',
      'digest_time',
      'immediate_severities',
      'quiet_hours_start',
      'quiet_hours_end'
    ];

    const filteredUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields provided for update'
      });
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
      console.error('📧 [Notifications] Error updating settings:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    console.log(`📧 [Notifications] Settings updated for ${userEmail}:`, Object.keys(filteredUpdates));

    res.json({
      success: true,
      settings: data,
      updated_fields: Object.keys(filteredUpdates).filter(k => k !== 'updated_at')
    });
  } catch (error) {
    console.error('📧 [Notifications] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
