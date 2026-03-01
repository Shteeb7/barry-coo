const express = require('express');
const { validateAuth } = require('../middleware/auth');
const { enrichChatContext } = require('../services/chat-context');
const { buildVoiceSystemPrompt } = require('../config/voice-persona');
const { getVoiceTools } = require('../config/voice-tools');
const { supabase } = require('../services/supabase');

// Import all tool handlers
const { executeSql } = require('../tools/execute-sql');
const { updateMemory } = require('../tools/update-memory');
const { createEscalation } = require('../tools/create-escalation');
const { queueTask } = require('../tools/queue-task');
const { readQueue } = require('../tools/read-queue');
const { completeQueueItem } = require('../tools/complete-queue-item');
const { createTaskConfig } = require('../tools/create-task-config');
const { updateTaskConfig } = require('../tools/update-task-config');
const { searchReports } = require('../tools/search-reports');
const { writeReport } = require('../tools/write-report');

const router = express.Router();

/**
 * POST /chat/voice/start
 * Initialize voice conversation session
 * Creates an ephemeral OpenAI Realtime session and returns credentials to client
 */
router.post('/start', validateAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = req.user.email;
    const { conversationType = 'general' } = req.body;

    console.log(`🎙️ [Barry Voice] Starting ${conversationType} session for ${email}`);

    // Enrich context based on conversation type
    const context = await enrichChatContext(userId, conversationType);

    // Build voice system prompt
    const systemPrompt = buildVoiceSystemPrompt(conversationType, context);

    // Get tools in OpenAI format
    const tools = getVoiceTools();

    // Create ephemeral OpenAI Realtime session
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-mini-realtime-preview-2024-12-17',
        voice: 'ash'  // Deeper, more authoritative voice for Barry
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ [Barry Voice] OpenAI session creation failed:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to create OpenAI session: ${response.status}`
      });
    }

    const session = await response.json();

    console.log('✅ [Barry Voice] OpenAI Realtime session created:', session.id);

    // Extract the actual token value from the client_secret object
    // OpenAI returns: { client_secret: { value: "eph_...", expires_at: ... } }
    const secretValue = typeof session.client_secret === 'object'
      ? session.client_secret.value
      : session.client_secret;

    const expiresAt = typeof session.client_secret === 'object'
      ? session.client_secret.expires_at
      : session.expires_at;

    // Create a session row in barry_chat_sessions with status 'voice_active'
    const { data: chatSession, error: sessionError } = await supabase
      .from('barry_chat_sessions')
      .insert({
        user_id: userId,
        conversation_type: conversationType,
        status: 'voice_active',
        system_prompt: systemPrompt,
        context: context,
        messages: []
      })
      .select()
      .single();

    if (sessionError) {
      console.error('❌ [Barry Voice] Failed to create chat session:', sessionError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create chat session'
      });
    }

    console.log(`✅ [Barry Voice] Chat session created: ${chatSession.id}`);

    res.json({
      success: true,
      sessionId: chatSession.id,
      clientSecret: secretValue,
      systemPrompt,
      tools,
      expiresAt,
      message: 'Voice session initialized'
    });
  } catch (error) {
    console.error('❌ [Barry Voice] Error starting session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /chat/voice/tool
 * Execute a tool server-side during voice conversation
 * Called by the browser when OpenAI Realtime triggers a function call
 */
router.post('/tool', validateAuth, async (req, res) => {
  try {
    const { sessionId, toolName, toolInput } = req.body;

    if (!sessionId || !toolName || !toolInput) {
      return res.status(400).json({
        success: false,
        error: 'sessionId, toolName, and toolInput are required'
      });
    }

    console.log(`🔧 [Barry Voice] Executing tool: ${toolName} for session ${sessionId}`);

    // Map tool names to their handlers
    const toolHandlers = {
      execute_sql: executeSql,
      update_memory: updateMemory,
      create_escalation: createEscalation,
      queue_task: queueTask,
      read_queue: readQueue,
      complete_queue_item: completeQueueItem,
      create_task_config: createTaskConfig,
      update_task_config: updateTaskConfig,
      search_reports: searchReports,
      write_report: writeReport,
      end_conversation: async (input) => ({
        success: true,
        summary: input.summary,
        message: 'Conversation ended'
      })
    };

    const handler = toolHandlers[toolName];

    if (!handler) {
      console.error(`❌ [Barry Voice] Unknown tool: ${toolName}`);
      return res.status(400).json({
        success: false,
        error: `Unknown tool: ${toolName}`
      });
    }

    // Execute the tool with the provided input
    // Different tools have different function signatures, so we need to handle them appropriately
    let result;

    switch (toolName) {
      case 'execute_sql':
        result = await handler(toolInput.query);
        break;
      case 'update_memory':
        result = await handler(toolInput.key, toolInput.value, toolInput.category);
        break;
      case 'create_escalation':
        result = await handler(toolInput.title, toolInput.description, toolInput.severity, toolInput.category, toolInput.metadata);
        break;
      case 'queue_task':
        result = await handler(toolInput.request_summary, toolInput.full_context, toolInput.required_tools, toolInput.priority, toolInput.target_mode);
        break;
      case 'read_queue':
        result = await handler(toolInput.status, toolInput.target_mode, toolInput.limit);
        break;
      case 'complete_queue_item':
        result = await handler(toolInput.id, toolInput.status, toolInput.result_summary, toolInput.result_detail, toolInput.error_message);
        break;
      case 'create_task_config':
        result = await handler(toolInput.task_name, toolInput.description, toolInput.cron_schedule, toolInput.prompt_template, toolInput.model, toolInput.enabled);
        break;
      case 'update_task_config':
        result = await handler(toolInput.task_name, toolInput.cron_schedule, toolInput.prompt_template, toolInput.enabled, toolInput.model, toolInput.description);
        break;
      case 'search_reports':
        result = await handler(toolInput.query, toolInput.report_type, toolInput.limit);
        break;
      case 'write_report':
        result = await handler(toolInput.report_type, toolInput.summary, toolInput.content, toolInput.metadata);
        break;
      case 'end_conversation':
        result = await handler(toolInput);
        break;
      default:
        result = { success: false, error: 'Tool handler not implemented' };
    }

    console.log(`✅ [Barry Voice] Tool ${toolName} executed successfully`);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('❌ [Barry Voice] Error executing tool:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /chat/voice/end
 * End voice conversation, process transcript, and save session
 */
router.post('/end', validateAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, transcript = '', toolResults = [], duration = 0 } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required'
      });
    }

    console.log(`🎙️ [Barry Voice] Ending session ${sessionId} (duration: ${duration}s)`);

    // Estimate cost from transcript length
    // Rough estimate: 1 token ≈ 0.75 words, so words / 0.75 = tokens
    // Rate: $0.00075 per token (blended audio + text)
    const estimatedTokens = Math.ceil(transcript.split(/\s+/).length / 0.75);
    const estimatedCost = estimatedTokens * 0.00075;

    console.log(`💰 [Barry Voice] Estimated cost: $${estimatedCost.toFixed(4)} (${estimatedTokens} tokens)`);

    // Convert transcript to messages array
    // Transcript format: "Steven: ... \nBarry: ... \nSteven: ..."
    const messages = [];
    const lines = transcript.split('\n');
    let currentRole = null;
    let currentContent = '';

    for (const line of lines) {
      if (line.startsWith('Steven:')) {
        if (currentRole && currentContent) {
          messages.push({ role: currentRole, content: currentContent.trim() });
        }
        currentRole = 'user';
        currentContent = line.replace('Steven:', '').trim();
      } else if (line.startsWith('Barry:')) {
        if (currentRole && currentContent) {
          messages.push({ role: currentRole, content: currentContent.trim() });
        }
        currentRole = 'assistant';
        currentContent = line.replace('Barry:', '').trim();
      } else if (line.trim()) {
        currentContent += ' ' + line.trim();
      }
    }

    // Add last message
    if (currentRole && currentContent) {
      messages.push({ role: currentRole, content: currentContent.trim() });
    }

    // Generate summary
    const summary = `Voice ${duration > 60 ? Math.floor(duration / 60) + ' minute' : duration + ' second'} session. ${toolResults.length} tool${toolResults.length === 1 ? '' : 's'} used.`;

    // Update chat session
    const { error: updateError } = await supabase
      .from('barry_chat_sessions')
      .update({
        messages,
        status: 'completed',
        summary,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('⚠️ [Barry Voice] Failed to update session:', updateError);
    }

    // TODO: Log cost to api_costs table if it exists
    // For now, just log to console
    console.log(`✅ [Barry Voice] Session ${sessionId} completed. Cost: $${estimatedCost.toFixed(4)}`);

    res.json({
      success: true,
      summary,
      actionsExecuted: toolResults.length,
      estimatedCost: estimatedCost.toFixed(4),
      message: 'Voice session ended successfully'
    });
  } catch (error) {
    console.error('❌ [Barry Voice] Error ending session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
