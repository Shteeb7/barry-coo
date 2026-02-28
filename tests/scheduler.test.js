/**
 * Tests for Barry's scheduler
 */

// Mock dependencies before requiring scheduler
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({
    stop: jest.fn()
  })),
  validate: jest.fn(() => true)
}));

jest.mock('../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            limit: jest.fn(() => ({
              maybeSingle: jest.fn()
            })),
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn()
              }))
            }))
          })),
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              maybeSingle: jest.fn()
            }))
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn()
      })),
      insert: jest.fn()
    }))
  }
}));

jest.mock('../src/services/brain', () => ({
  callBarry: jest.fn()
}));

const cron = require('node-cron');
const { supabase } = require('../src/services/supabase');
const { callBarry } = require('../src/services/brain');

describe('scheduler service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('task registration', () => {
    test('registers enabled tasks with valid cron schedules', async () => {
      const mockTasks = [
        {
          task_name: 'daily_briefing',
          cron_schedule: '0 13 * * *',
          prompt_template: 'Test prompt',
          model: 'claude-sonnet-4-5-20250929',
          enabled: true,
          max_retries: 3,
          consecutive_failures: 0
        }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: mockTasks, error: null })
        }))
      });

      const { startScheduler } = require('../src/services/scheduler');
      await startScheduler();

      expect(cron.schedule).toHaveBeenCalledWith('0 13 * * *', expect.any(Function));
    });

    test('skips tasks with invalid cron schedules', async () => {
      const mockTasks = [
        {
          task_name: 'invalid_task',
          cron_schedule: 'invalid cron',
          enabled: true
        }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: mockTasks, error: null })
        }))
      });

      cron.validate.mockReturnValue(false);

      const { startScheduler } = require('../src/services/scheduler');
      await startScheduler();

      expect(cron.schedule).not.toHaveBeenCalled();
    });
  });

  describe('circuit breaker', () => {
    test('skips task execution when max retries reached', async () => {
      const taskConfig = {
        task_name: 'failing_task',
        prompt_template: 'Test',
        model: 'claude-sonnet-4-5-20250929',
        max_retries: 3,
        consecutive_failures: 3 // Already at max
      };

      const mockUpdate = jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      }));

      supabase.from.mockReturnValue({
        update: mockUpdate,
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
              }))
            }))
          }))
        }))
      });

      const { executeTask } = require('../src/services/scheduler');
      await executeTask(taskConfig);

      // Should not call Barry's brain
      expect(callBarry).not.toHaveBeenCalled();

      // Should update last_run_status to 'skipped'
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ last_run_status: 'skipped' })
      );
    });

    test('disables task and creates escalation after max retries', async () => {
      const taskConfig = {
        task_name: 'failing_task',
        prompt_template: 'Test',
        model: 'claude-sonnet-4-5-20250929',
        max_retries: 3,
        consecutive_failures: 2 // One failure away from max
      };

      // Mock brain failure
      callBarry.mockRejectedValue(new Error('API failure'));

      const mockUpdate = jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      }));

      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });

      let updateCallCount = 0;
      supabase.from.mockImplementation((table) => {
        if (table === 'barry_task_configs') {
          return { update: mockUpdate };
        } else if (table === 'barry_escalations') {
          return { insert: mockInsert };
        } else if (table === 'barry_reports') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
                  }))
                })),
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
                  }))
                }))
              }))
            }))
          };
        }
      });

      const { executeTask } = require('../src/services/scheduler');
      await executeTask(taskConfig);

      // Should update consecutive_failures to 3
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ consecutive_failures: 3 })
      );

      // Should disable the task
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false })
      );

      // Should create critical escalation
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          source_task: 'failing_task'
        })
      );
    });

    test('resets consecutive_failures on success', async () => {
      const taskConfig = {
        task_name: 'recovering_task',
        prompt_template: 'Test',
        model: 'claude-sonnet-4-5-20250929',
        max_retries: 3,
        consecutive_failures: 2 // Had failures before but will succeed now
      };

      // Mock successful brain call
      callBarry.mockResolvedValue({
        content: 'Success report',
        tokensIn: 1000,
        tokensOut: 500,
        cost: 0.05,
        model: 'claude-sonnet-4-5-20250929'
      });

      const mockUpdate = jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      }));

      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });

      supabase.from.mockImplementation((table) => {
        if (table === 'barry_task_configs') {
          return { update: mockUpdate };
        } else if (table === 'barry_reports') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                gte: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
                  }))
                })),
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
                  }))
                }))
              }))
            })),
            insert: mockInsert
          };
        }
      });

      const { executeTask } = require('../src/services/scheduler');
      await executeTask(taskConfig);

      // Should reset consecutive_failures to 0
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          consecutive_failures: 0,
          last_run_status: 'success'
        })
      );
    });
  });
});
