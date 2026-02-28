/**
 * Tests for Barry's queue tools
 */

const { queueTask } = require('../src/tools/queue-task');
const { readQueue } = require('../src/tools/read-queue');
const { completeQueueItem } = require('../src/tools/complete-queue-item');

// Mock Supabase
jest.mock('../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          then: jest.fn()
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      }))
    }))
  }
}));

const { supabase } = require('../src/services/supabase');

describe('queue tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('queueTask', () => {
    test('creates a queue item with all fields', async () => {
      const mockInsert = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'test-uuid',
              request_summary: 'Test task',
              queued_at: new Date().toISOString()
            },
            error: null
          })
        }))
      }));

      supabase.from.mockReturnValue({ insert: mockInsert });

      const result = await queueTask(
        'Test task',
        'Full context here',
        ['google_drive', 'gmail'],
        'P1',
        'cowork'
      );

      expect(result.success).toBe(true);
      expect(result.request_summary).toBe('Test task');
      expect(result.target_mode).toBe('cowork');
      expect(result.priority).toBe('P1');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          request_summary: 'Test task',
          full_context: 'Full context here',
          required_tools: ['google_drive', 'gmail'],
          priority: 'P1',
          queued_by: 'railway',  // Always 'railway' for this tool
          target_mode: 'cowork',
          status: 'pending'
        })
      );
    });

    test('sets queued_by to railway by default', async () => {
      const mockInsert = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { id: 'test-uuid', queued_at: new Date().toISOString() },
            error: null
          })
        }))
      }));

      supabase.from.mockReturnValue({ insert: mockInsert });

      await queueTask('Test', null, [], 'P2', 'cowork');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ queued_by: 'railway' })
      );
    });

    test('uses default values for optional parameters', async () => {
      const mockInsert = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { id: 'test-uuid', queued_at: new Date().toISOString() },
            error: null
          })
        }))
      }));

      supabase.from.mockReturnValue({ insert: mockInsert });

      await queueTask('Test task');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'P2',
          target_mode: 'cowork',
          required_tools: []
        })
      );
    });

    test('handles database errors gracefully', async () => {
      const mockInsert = jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Insert failed' }
          })
        }))
      }));

      supabase.from.mockReturnValue({ insert: mockInsert });

      const result = await queueTask('Test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insert failed');
    });
  });

  describe('readQueue', () => {
    test('returns all queue items when no filters provided', async () => {
      const mockData = [
        { id: '1', priority: 'P1', queued_at: new Date('2026-02-28T10:00:00Z').toISOString() },
        { id: '2', priority: 'P0', queued_at: new Date('2026-02-28T11:00:00Z').toISOString() },
        { id: '3', priority: 'P2', queued_at: new Date('2026-02-28T09:00:00Z').toISOString() }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: mockData, error: null })
      });

      const result = await readQueue();

      expect(result.success).toBe(true);
      expect(result.items).toBeDefined();
      expect(result.count).toBe(3);
    });

    test('orders by priority then queued_at', async () => {
      const mockData = [
        { id: '1', priority: 'P1', queued_at: new Date('2026-02-28T10:00:00Z').toISOString() },
        { id: '2', priority: 'P0', queued_at: new Date('2026-02-28T11:00:00Z').toISOString() },
        { id: '3', priority: 'P2', queued_at: new Date('2026-02-28T09:00:00Z').toISOString() },
        { id: '4', priority: 'P0', queued_at: new Date('2026-02-28T08:00:00Z').toISOString() }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: mockData, error: null })
      });

      const result = await readQueue(null, null, 10);

      expect(result.success).toBe(true);
      // Should be ordered: P0 (id 4), P0 (id 2), P1 (id 1), P2 (id 3)
      expect(result.items[0].id).toBe('4'); // P0, earliest
      expect(result.items[1].id).toBe('2'); // P0, later
      expect(result.items[2].id).toBe('1'); // P1
      expect(result.items[3].id).toBe('3'); // P2
    });

    test('applies limit correctly', async () => {
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        priority: 'P2',
        queued_at: new Date().toISOString()
      }));

      supabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: mockData, error: null })
      });

      const result = await readQueue(null, null, 5);

      expect(result.success).toBe(true);
      expect(result.items.length).toBe(5);
    });

    test('handles database errors gracefully', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Query failed' }
        })
      });

      const result = await readQueue();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query failed');
    });
  });

  describe('completeQueueItem', () => {
    test('marks queue item as completed with results', async () => {
      const mockUpdate = jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-uuid',
                request_summary: 'Test task',
                completed_at: new Date().toISOString()
              },
              error: null
            })
          }))
        }))
      }));

      supabase.from.mockReturnValue({ update: mockUpdate });

      const result = await completeQueueItem(
        'test-uuid',
        'completed',
        'Task finished successfully',
        'Full details here'
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          result_summary: 'Task finished successfully',
          result_detail: 'Full details here'
        })
      );
    });

    test('marks queue item as failed with error message', async () => {
      const mockUpdate = jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'test-uuid',
                completed_at: new Date().toISOString()
              },
              error: null
            })
          }))
        }))
      }));

      supabase.from.mockReturnValue({ update: mockUpdate });

      const result = await completeQueueItem(
        'test-uuid',
        'failed',
        'Task failed',
        null,
        'Error: Something went wrong'
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('failed');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: 'Error: Something went wrong'
        })
      );
    });

    test('rejects invalid status values', async () => {
      const result = await completeQueueItem('test-uuid', 'invalid_status');

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be');
    });

    test('handles database errors gracefully', async () => {
      const mockUpdate = jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Update failed' }
            })
          }))
        }))
      }));

      supabase.from.mockReturnValue({ update: mockUpdate });

      const result = await completeQueueItem('test-uuid', 'completed');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });
});
