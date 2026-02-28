/**
 * Tests for Barry's brain (Claude API wrapper)
 */

const { buildSystemPrompt } = require('../src/services/brain');

// Mock Supabase
jest.mock('../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          then: jest.fn()
        }))
      }))
    }))
  }
}));

const { supabase } = require('../src/services/supabase');

describe('brain service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildSystemPrompt', () => {
    test('includes core identity', async () => {
      // Mock empty persona parameters
      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: [], error: null })
        }))
      });

      const prompt = await buildSystemPrompt();

      expect(prompt).toContain('Barry');
      expect(prompt).toContain('Chief Operating Officer');
      expect(prompt).toContain('Thorne');
      expect(prompt).toContain('Autonomy Boundaries');
    });

    test('includes dynamic persona parameters', async () => {
      // Mock persona parameters from database
      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            data: [
              { key: 'persona_humor_level', value: 'high' },
              { key: 'persona_sarcasm_mode', value: 'surgical' }
            ],
            error: null
          })
        }))
      });

      const prompt = await buildSystemPrompt();

      expect(prompt).toContain('humor_level');
      expect(prompt).toContain('high');
      expect(prompt).toContain('sarcasm_mode');
      expect(prompt).toContain('surgical');
    });

    test('includes task context when provided', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: [], error: null })
        }))
      });

      const taskContext = 'Current Date: 2026-02-28\nLast Report: Previous findings...';
      const prompt = await buildSystemPrompt(taskContext);

      expect(prompt).toContain('Task Context');
      expect(prompt).toContain('Current Date: 2026-02-28');
      expect(prompt).toContain('Last Report: Previous findings');
    });

    test('handles database errors gracefully', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          })
        }))
      });

      const prompt = await buildSystemPrompt();

      // Should still return core identity even if persona params fail to load
      expect(prompt).toContain('Barry');
      expect(prompt).toContain('Chief Operating Officer');
    });
  });
});
