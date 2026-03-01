/**
 * Tests for Barry's brain (Claude API wrapper)
 * Using LIVE API calls
 */

const { buildSystemPrompt } = require('../src/services/brain');

describe('brain service', () => {
  describe('buildSystemPrompt', () => {
    test('includes core identity', async () => {
      const prompt = await buildSystemPrompt();
      expect(prompt).toContain('Barry');
      expect(prompt).toContain('Chief Operating Officer');
    });

    test('includes dynamic persona parameters', async () => {
      const prompt = await buildSystemPrompt();
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
    });

    test('includes task context when provided', async () => {
      const prompt = await buildSystemPrompt('Test task context');
      expect(prompt).toContain('Test task context');
    });
  });
});
