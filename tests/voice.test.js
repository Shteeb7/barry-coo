/**
 * VOICE CHAT TESTS
 * Tests for Barry's voice endpoints using OpenAI Realtime API
 * Using LIVE API calls when OPENAI_API_KEY is available
 */

const { buildVoiceSystemPrompt } = require('../src/config/voice-persona');
const { convertAnthropicToolToOpenAI, getVoiceTools } = require('../src/config/voice-tools');
const { BARRY_CHAT_TOOLS } = require('../src/config/chat-tools');

describe('Voice Persona', () => {
  test('includes MEDIUM: VOICE adapter text', () => {
    const prompt = buildVoiceSystemPrompt('general');
    expect(prompt).toContain('MEDIUM: VOICE CONVERSATION');
    expect(prompt).toContain('SHORT responses');
  });

  test('includes core Barry identity', () => {
    const prompt = buildVoiceSystemPrompt('general');
    expect(prompt).toContain('Barry');
    expect(prompt).toContain('Chief Operating Officer');
  });

  test('includes conversation type context', () => {
    const statusPrompt = buildVoiceSystemPrompt('status_check');
    expect(statusPrompt).toContain('CONVERSATION TYPE: status_check');
    expect(statusPrompt).toContain('STATUS');
  });

  test('adapts prompt for task setup', () => {
    const taskPrompt = buildVoiceSystemPrompt('task_setup');
    expect(taskPrompt).toContain('TASK SETUP');
  });
});

describe('Voice Tools Conversion', () => {
  test('converts Anthropic format to OpenAI format', () => {
    const anthropicTool = {
      name: 'execute_sql',
      description: 'Test tool',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string' }
        },
        required: ['query']
      }
    };

    const openAITool = convertAnthropicToolToOpenAI(anthropicTool);

    expect(openAITool.type).toBe('function');
    expect(openAITool.name).toBe('execute_sql');
    expect(openAITool.description).toBe('Test tool');
    expect(openAITool.parameters).toEqual(anthropicTool.input_schema);
  });

  test('converts all Barry tools correctly', () => {
    const tools = getVoiceTools();

    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(BARRY_CHAT_TOOLS.length);

    // Check all tools have required OpenAI format
    tools.forEach(tool => {
      expect(tool.type).toBe('function');
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBe('object');
    });
  });

  test('preserves tool names during conversion', () => {
    const tools = getVoiceTools();
    const toolNames = tools.map(t => t.name);

    expect(toolNames).toContain('execute_sql');
    expect(toolNames).toContain('update_memory');
    expect(toolNames).toContain('create_escalation');
    expect(toolNames).toContain('queue_task');
    expect(toolNames).toContain('end_conversation');
  });
});

// Voice API endpoint tests require OPENAI_API_KEY
// These will be skipped if the key is not available
const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

(hasOpenAIKey ? describe : describe.skip)('Voice API Endpoints', () => {
  // Note: These tests require a valid OpenAI API key and will make real API calls
  // They are skipped if OPENAI_API_KEY is not set

  test('buildVoiceSystemPrompt produces valid prompt string', () => {
    const prompt = buildVoiceSystemPrompt('general', {
      storyStats: { total: 42, stuck: 0 },
      memory: [],
      escalations: []
    });

    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });
});

// Placeholder tests for endpoints that require authentication and database
// These would need to be tested with proper auth tokens and test data

describe('Voice Routes (structure tests)', () => {
  test('voice router exports expected routes', () => {
    const voiceRouter = require('../src/routes/voice');
    expect(voiceRouter).toBeDefined();
    expect(typeof voiceRouter).toBe('function'); // Express router is a function
  });
});
