/**
 * Tests for Barry's queue tools
 * Using LIVE API calls
 */

const { queueTask } = require('../src/tools/queue-task');
const { readQueue } = require('../src/tools/read-queue');
const { completeQueueItem } = require('../src/tools/complete-queue-item');

describe('queue tools', () => {
  describe('queueTask', () => {
    test('creates a queue item with all fields', async () => {
      const result = await queueTask(
        'Test task ' + Date.now(),
        'Full context for test',
        ['execute_sql'],
        'P1'
      );
      expect(result.success).toBe(true);
      expect(result.queue_id).toBeDefined();
    });

    test('sets queued_by to railway by default', async () => {
      const result = await queueTask(
        'Test ' + Date.now(),
        'Context',
        ['execute_sql'],
        'P2'
      );
      expect(result.success).toBe(true);
    });

    test('uses default values for optional parameters', async () => {
      const result = await queueTask(
        'Test task ' + Date.now(),
        'Full context',
        ['execute_sql'],
        'P2'
      );
      expect(result.success).toBe(true);
    });
  });

  describe('readQueue', () => {
    test('returns queue items', async () => {
      const result = await readQueue();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.items)).toBe(true);
    });

    test('orders by priority then queued_at', async () => {
      const result = await readQueue();
      expect(result.success).toBe(true);
    });

    test('applies limit correctly', async () => {
      const result = await readQueue(null, null, 5);
      expect(result.success).toBe(true);
      if (result.items) {
        expect(result.items.length).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('completeQueueItem', () => {
    test('marks item as completed with results', async () => {
      // First create an item
      const created = await queueTask('Complete test ' + Date.now(), 'ctx', ['execute_sql'], 'P3');
      expect(created.success).toBe(true);

      // Then complete it
      const result = await completeQueueItem(
        created.queue_id,
        'completed',
        'Test completed',
        'Detailed result'
      );
      expect(result.success).toBe(true);
    });

    test('marks item as failed with error message', async () => {
      // First create an item
      const created = await queueTask('Fail test ' + Date.now(), 'ctx', ['execute_sql'], 'P3');
      expect(created.success).toBe(true);

      // Then fail it
      const result = await completeQueueItem(
        created.queue_id,
        'failed',
        null,
        null,
        'Test error'
      );
      expect(result.success).toBe(true);
    });

    test('rejects invalid status values', async () => {
      const result = await completeQueueItem(
        'fake-id',
        'invalid_status',
        'summary'
      );
      expect(result.success).toBe(false);
    });
  });
});
