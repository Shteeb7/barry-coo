/**
 * BARRY CHAT ROUTES
 *
 * Web chat API endpoints
 */

const express = require('express');
const { validateAuth } = require('../middleware/auth');
const {
  startSession,
  sendMessage,
  getSession,
  listSessions
} = require('../services/chat-service');

const router = express.Router();

/**
 * POST /chat/start
 * Start a new chat session
 *
 * Body:
 *   - conversationType: 'general' | 'status_check' | 'task_setup' | 'escalation_review' | 'idea_brainstorm'
 *
 * Returns:
 *   - sessionId: UUID
 *   - openingMessage: Barry's greeting
 */
router.post('/start', validateAuth, async (req, res) => {
  try {
    const { conversationType = 'general' } = req.body;
    const userId = req.userId;

    // Validate conversation type
    const validTypes = ['general', 'status_check', 'task_setup', 'escalation_review', 'idea_brainstorm'];
    if (!validTypes.includes(conversationType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid conversationType. Must be one of: general, status_check, task_setup, escalation_review, idea_brainstorm'
      });
    }

    const result = await startSession(userId, conversationType);

    res.json({
      success: true,
      sessionId: result.sessionId,
      openingMessage: result.openingMessage
    });
  } catch (error) {
    console.error('🎩 [Barry Chat] Error starting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start chat session'
    });
  }
});

/**
 * POST /chat/send
 * Send a message in an existing session
 *
 * Body:
 *   - sessionId: UUID
 *   - message: string
 *
 * Returns:
 *   - message: Barry's response
 *   - toolCalls: array of tool names that fired
 *   - sessionComplete: boolean
 */
router.post('/send', validateAuth, async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing sessionId or message'
      });
    }

    const result = await sendMessage(sessionId, message);

    res.json({
      success: true,
      message: result.message,
      toolCalls: result.toolCalls,
      sessionComplete: result.sessionComplete
    });
  } catch (error) {
    console.error('🎩 [Barry Chat] Error sending message:', error);

    if (error.message === 'Session not found') {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

/**
 * GET /chat/session/:sessionId
 * Get a session by ID (for resuming conversations)
 *
 * Returns:
 *   - session: full session object
 */
router.get('/session/:sessionId', validateAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await getSession(sessionId);

    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('🎩 [Barry Chat] Error getting session:', error);

    if (error.message === 'Session not found') {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get session'
    });
  }
});

/**
 * GET /chat/sessions
 * List recent sessions for the current user
 *
 * Returns:
 *   - sessions: array of session summaries
 */
router.get('/sessions', validateAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const sessions = await listSessions(userId);

    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('🎩 [Barry Chat] Error listing sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list sessions'
    });
  }
});

module.exports = router;
