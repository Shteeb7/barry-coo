/**
 * Tests for Barry's scheduler
 * Simplified for live testing
 */

const cron = require('node-cron');

describe('scheduler service', () => {
  describe('cron validation', () => {
    test('validates correct cron expressions', () => {
      expect(cron.validate('0 13 * * *')).toBe(true);
      expect(cron.validate('0 15 * * 5')).toBe(true);
    });

    test('rejects invalid cron expressions', () => {
      expect(cron.validate('invalid cron')).toBe(false);
      expect(cron.validate('99 99 * * *')).toBe(false);
    });
  });
});
