const { notifyEscalation, notifyReport, notifyTaskFailure, sendDailyDigest } = require('../src/services/notification-dispatcher');
const { sendEmail } = require('../src/services/email-service');
const { supabase } = require('../src/services/supabase');

jest.mock('../src/services/email-service');

describe('Notification System', () => {
  const testUserEmail = process.env.ALLOWED_EMAILS?.split(',')[0]?.trim() || 'steven.labrum@gmail.com';

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock sendEmail to succeed by default
    sendEmail.mockResolvedValue({ success: true, messageId: 'test-message-id' });
  });

  afterAll(async () => {
    // Clean up notification settings created during tests
    await supabase
      .from('barry_notification_settings')
      .delete()
      .eq('user_email', testUserEmail);
  });

  describe('notifyEscalation', () => {
    test('sends immediate email for critical escalation', async () => {
      const escalation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Critical Escalation',
        description: 'Test description',
        severity: 'critical',
        category: 'test',
        status: 'open',
        created_at: new Date().toISOString()
      };

      await notifyEscalation(escalation);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Critical'),
          html: expect.stringContaining('Test Critical Escalation'),
          text: expect.stringContaining('Test Critical Escalation')
        })
      );
    });

    test('sends immediate email for high escalation', async () => {
      const escalation = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test High Escalation',
        description: 'Test description',
        severity: 'high',
        category: 'test',
        status: 'open',
        created_at: new Date().toISOString()
      };

      await notifyEscalation(escalation);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('High'),
          html: expect.stringContaining('Test High Escalation')
        })
      );
    });

    test('does NOT send immediate email for warning escalation', async () => {
      const escalation = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        title: 'Test Warning Escalation',
        description: 'Test description',
        severity: 'warning',
        category: 'test',
        status: 'open',
        created_at: new Date().toISOString()
      };

      await notifyEscalation(escalation);

      // Should not send immediate email for warning severity
      expect(sendEmail).not.toHaveBeenCalled();
    });

    test('wraps errors gracefully without crashing', async () => {
      sendEmail.mockRejectedValue(new Error('Email service down'));

      const escalation = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        title: 'Test Escalation',
        description: 'Test description',
        severity: 'critical',
        category: 'test',
        status: 'open',
        created_at: new Date().toISOString()
      };

      // Should not throw
      await expect(notifyEscalation(escalation)).resolves.not.toThrow();
    });
  });

  describe('notifyReport', () => {
    test('sends immediate email for critical report', async () => {
      const report = {
        id: '123e4567-e89b-12d3-a456-426614174100',
        report_type: 'daily_briefing',
        summary: 'Critical issues detected',
        content: 'Test report content',
        metadata: { severity: 'critical' },
        created_at: new Date().toISOString()
      };

      await notifyReport(report);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Critical'),
          html: expect.stringContaining('Critical issues detected')
        })
      );
    });

    test('does NOT send immediate email for info report', async () => {
      const report = {
        id: '123e4567-e89b-12d3-a456-426614174101',
        report_type: 'daily_briefing',
        summary: 'Normal operations',
        content: 'Test report content',
        metadata: { severity: 'info' },
        created_at: new Date().toISOString()
      };

      await notifyReport(report);

      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('notifyTaskFailure', () => {
    test('sends immediate email for task failure', async () => {
      await notifyTaskFailure('test_task', 'Test error message', 1, 3);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('failed'),
          html: expect.stringContaining('test_task'),
          text: expect.stringContaining('Test error message')
        })
      );
    });

    test('sends immediate email for permanent failure', async () => {
      await notifyTaskFailure('test_task', 'Test error message', 3, 3);

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('permanently failed'),
          html: expect.stringContaining('test_task')
        })
      );
    });
  });

  describe('sendDailyDigest', () => {
    test('sends daily digest email with aggregated data', async () => {
      // Create test data
      const testReport = await supabase
        .from('barry_reports')
        .insert({
          report_type: 'test',
          summary: 'Test report for digest',
          content: 'Test content',
          metadata: {}
        })
        .select()
        .single();

      await sendDailyDigest();

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Daily Brief'),
          html: expect.any(String),
          text: expect.any(String)
        })
      );

      // Clean up
      if (testReport.data) {
        await supabase
          .from('barry_reports')
          .delete()
          .eq('id', testReport.data.id);
      }
    });
  });

  describe('Email Service', () => {
    test('handles missing API key gracefully', async () => {
      // Get the real email service implementation
      const { sendEmail: realSendEmail } = jest.requireActual('../src/services/email-service');

      // Save original env var
      const originalApiKey = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;

      const result = await realSendEmail({
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_api_key');

      // Restore
      if (originalApiKey) {
        process.env.RESEND_API_KEY = originalApiKey;
      }
    });
  });

  describe('Notification Settings', () => {
    test('respects quiet hours for immediate notifications', async () => {
      // Set quiet hours
      await supabase
        .from('barry_notification_settings')
        .upsert({
          user_email: testUserEmail,
          email_enabled: true,
          quiet_hours_start: '00:00',
          quiet_hours_end: '23:59' // All day quiet
        }, {
          onConflict: 'user_email'
        });

      const escalation = {
        id: '123e4567-e89b-12d3-a456-426614174200',
        title: 'Test Quiet Hours',
        description: 'Should be queued for digest',
        severity: 'critical',
        category: 'test',
        status: 'open',
        created_at: new Date().toISOString()
      };

      await notifyEscalation(escalation);

      // Should NOT send immediate email during quiet hours
      expect(sendEmail).not.toHaveBeenCalled();
    });

    test('respects email_enabled setting', async () => {
      // Disable all emails
      await supabase
        .from('barry_notification_settings')
        .upsert({
          user_email: testUserEmail,
          email_enabled: false
        }, {
          onConflict: 'user_email'
        });

      const escalation = {
        id: '123e4567-e89b-12d3-a456-426614174201',
        title: 'Test Email Disabled',
        description: 'Should not send',
        severity: 'critical',
        category: 'test',
        status: 'open',
        created_at: new Date().toISOString()
      };

      await notifyEscalation(escalation);

      expect(sendEmail).not.toHaveBeenCalled();

      // Reset
      await supabase
        .from('barry_notification_settings')
        .upsert({
          user_email: testUserEmail,
          email_enabled: true,
          quiet_hours_start: null,
          quiet_hours_end: null
        }, {
          onConflict: 'user_email'
        });
    });
  });
});
