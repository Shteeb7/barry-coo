/**
 * CHAT SERVICE TESTS
 * Using LIVE API calls with real Claude integration
 */

const { startSession, sendMessage, getSession, listSessions } = require('../src/services/chat-service');

// Use a test user ID
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

describe('Chat Service', () => {
  let testSessionId;

  describe('startSession', () => {
    test('creates a new session and returns opening message', async () => {
      const result = await startSession(TEST_USER_ID, 'general');

      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('openingMessage');
      expect(typeof result.sessionId).toBe('string');
      expect(typeof result.openingMessage).toBe('string');
      expect(result.openingMessage.length).toBeGreaterThan(0);

      testSessionId = result.sessionId;
    }, 30000);

    test('supports different conversation types', async () => {
      const result = await startSession(TEST_USER_ID, 'status_check');

      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('openingMessage');
    }, 30000);
  });

  describe('sendMessage', () => {
    test('sends message and returns response', async () => {
      if (!testSessionId) {
        const session = await startSession(TEST_USER_ID, 'general');
        testSessionId = session.sessionId;
      }

      const result = await sendMessage(testSessionId, 'What is 2+2?');

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('toolCalls');
      expect(result).toHaveProperty('sessionComplete');
      expect(typeof result.message).toBe('string');
      expect(Array.isArray(result.toolCalls)).toBe(true);
    }, 30000);
  });

  describe('getSession', () => {
    test('returns session by ID', async () => {
      if (!testSessionId) {
        const session = await startSession(TEST_USER_ID, 'general');
        testSessionId = session.sessionId;
      }

      const result = await getSession(testSessionId);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('messages');
      expect(result.id).toBe(testSessionId);
    }, 10000);
  });

  describe('listSessions', () => {
    test('returns session list for user', async () => {
      const result = await listSessions(TEST_USER_ID);

      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('conversationType');
      }
    }, 10000);
  });
});
