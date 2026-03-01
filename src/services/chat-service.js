/**
 * BARRY CHAT SERVICE
 *
 * Core chat logic: session management, message loop, tool execution
 * Pattern adapted from neverending-story-api/src/services/chat.js
 */

const { v4: uuidv4 } = require('uuid');
const { Anthropic } = require('@anthropic-ai/sdk');
const { supabase } = require('./supabase');
const { enrichChatContext } = require('./chat-context');
const { buildChatSystemPrompt } = require('../config/chat-persona');
const { BARRY_CHAT_TOOLS } = require('../config/chat-tools');

// Import tool handlers
const { executeSql } = require('../tools/execute-sql');
const { updateMemory } = require('../tools/update-memory');
const { createEscalation } = require('../tools/create-escalation');
const { queueTask } = require('../tools/queue-task');
const { readQueue } = require('../tools/read-queue');
const { completeQueueItem } = require('../tools/complete-queue-item');

// Initialize Anthropic client
const anthropic = process.env.NODE_ENV !== 'test'
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_ROUNDS = 10; // Prevent infinite loops

/**
 * Start a new chat session
 * @param {string} userId - User ID
 * @param {string} conversationType - Type of conversation
 * @returns {Object} { sessionId, openingMessage }
 */
async function startSession(userId, conversationType = 'general') {
  console.log(`🎩 [Barry Chat] Starting ${conversationType} session for user ${userId}`);

  // Enrich context
  const context = await enrichChatContext(userId, conversationType);

  // Build system prompt
  const systemPrompt = buildChatSystemPrompt(context, conversationType);

  // Call Claude to get opening greeting
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Start the conversation with a contextual greeting. Be aware of what's in the context (open escalations, pending queue items, etc.) and reference relevant items naturally if appropriate. Keep it brief — 2-3 sentences max.`
      }
    ]
  });

  const openingMessage = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  // Create session in database
  const sessionId = uuidv4();
  const { error: insertError } = await supabase
    .from('barry_chat_sessions')
    .insert({
      id: sessionId,
      user_id: userId,
      conversation_type: conversationType,
      messages: [{ role: 'assistant', content: openingMessage }],
      system_prompt: systemPrompt,
      context,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (insertError) {
    console.error('🎩 [Barry Chat] Error creating session:', insertError);
    throw new Error('Failed to create chat session');
  }

  console.log(`🎩 [Barry Chat] Session ${sessionId} created`);

  return {
    sessionId,
    openingMessage
  };
}

/**
 * Send a message and get response
 * @param {string} sessionId - Session ID
 * @param {string} userMessage - User's message
 * @returns {Object} { message, toolCalls, sessionComplete }
 */
async function sendMessage(sessionId, userMessage) {
  console.log(`🎩 [Barry Chat] Processing message in session ${sessionId}`);

  // Fetch session
  const { data: session, error: fetchError } = await supabase
    .from('barry_chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (fetchError || !session) {
    console.error('🎩 [Barry Chat] Session not found:', sessionId);
    throw new Error('Session not found');
  }

  // Append user message
  const messages = [...session.messages, { role: 'user', content: userMessage }];

  let conversationRounds = 0;
  let finalResponse = '';
  const toolCallsList = [];
  let sessionComplete = false;

  // Tool-use loop
  while (conversationRounds < MAX_ROUNDS) {
    conversationRounds++;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: session.system_prompt,
      messages,
      tools: BARRY_CHAT_TOOLS
    });

    // Check for tool uses
    const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
    const textBlocks = response.content.filter(block => block.type === 'text');

    // Accumulate text
    for (const block of textBlocks) {
      finalResponse += block.text;
    }

    // If no tools, we're done
    if (toolUseBlocks.length === 0) {
      break;
    }

    // Execute tools
    const toolResults = [];
    for (const toolBlock of toolUseBlocks) {
      const toolName = toolBlock.name;
      const toolInput = toolBlock.input;

      console.log(`🎩 [Barry Chat] Executing tool: ${toolName}`);
      toolCallsList.push(toolName);

      let toolResult;
      try {
        toolResult = await executeChatTool(toolName, toolInput, sessionId);

        // Check if end_conversation was called
        if (toolName === 'end_conversation') {
          sessionComplete = true;
        }
      } catch (error) {
        console.error(`🎩 [Barry Chat] Tool execution error (${toolName}):`, error);
        toolResult = {
          success: false,
          error: error.message
        };
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolBlock.id,
        content: JSON.stringify(toolResult)
      });
    }

    // Append assistant's response with tool uses and tool results
    messages.push({
      role: 'assistant',
      content: response.content
    });

    messages.push({
      role: 'user',
      content: toolResults
    });

    // If session is complete, break
    if (sessionComplete) {
      break;
    }
  }

  if (conversationRounds >= MAX_ROUNDS) {
    console.warn(`🎩 [Barry Chat] Hit max rounds (${MAX_ROUNDS}) for session ${sessionId}`);
    finalResponse += '\n\n[Reached maximum conversation depth]';
  }

  // Update session in database
  const { error: updateError } = await supabase
    .from('barry_chat_sessions')
    .update({
      messages,
      status: sessionComplete ? 'completed' : 'active',
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId);

  if (updateError) {
    console.error('🎩 [Barry Chat] Error updating session:', updateError);
  }

  return {
    message: finalResponse,
    toolCalls: toolCallsList,
    sessionComplete
  };
}

/**
 * Execute a chat tool
 * @param {string} toolName - Tool name
 * @param {Object} toolInput - Tool input
 * @param {string} sessionId - Session ID
 * @returns {Object} Tool result
 */
async function executeChatTool(toolName, toolInput, sessionId) {
  switch (toolName) {
    case 'execute_sql':
      return await executeSql(toolInput.query);

    case 'update_memory':
      return await updateMemory(toolInput.key, toolInput.value, toolInput.category);

    case 'create_escalation':
      return await createEscalation(
        toolInput.title,
        toolInput.description,
        toolInput.severity,
        toolInput.category,
        toolInput.metadata
      );

    case 'queue_task':
      return await queueTask(
        toolInput.request_summary,
        toolInput.full_context,
        toolInput.required_tools,
        toolInput.priority,
        toolInput.target_mode
      );

    case 'read_queue':
      return await readQueue(
        toolInput.status,
        toolInput.target_mode,
        toolInput.limit
      );

    case 'complete_queue_item':
      return await completeQueueItem(
        toolInput.id,
        toolInput.status,
        toolInput.result_summary,
        toolInput.result_detail,
        toolInput.error_message
      );

    case 'end_conversation':
      // Update session with summary
      await supabase
        .from('barry_chat_sessions')
        .update({ summary: toolInput.summary })
        .eq('id', sessionId);
      return { success: true, summary: toolInput.summary };

    case 'create_task_config':
      const { data: newTask, error: createError } = await supabase
        .from('barry_task_configs')
        .insert({
          task_name: toolInput.task_name,
          description: toolInput.description,
          cron_schedule: toolInput.cron_schedule,
          prompt_template: toolInput.prompt_template,
          model: toolInput.model || MODEL,
          enabled: toolInput.enabled !== undefined ? toolInput.enabled : true
        })
        .select()
        .single();

      if (createError) {
        return { success: false, error: createError.message };
      }
      return { success: true, task: newTask };

    case 'update_task_config':
      const updates = {};
      if (toolInput.cron_schedule) updates.cron_schedule = toolInput.cron_schedule;
      if (toolInput.prompt_template) updates.prompt_template = toolInput.prompt_template;
      if (toolInput.enabled !== undefined) updates.enabled = toolInput.enabled;
      if (toolInput.model) updates.model = toolInput.model;
      if (toolInput.description) updates.description = toolInput.description;

      const { data: updatedTask, error: updateError } = await supabase
        .from('barry_task_configs')
        .update(updates)
        .eq('task_name', toolInput.task_name)
        .select()
        .single();

      if (updateError) {
        return { success: false, error: updateError.message };
      }
      return { success: true, task: updatedTask };

    case 'search_reports':
      let query = supabase
        .from('barry_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (toolInput.report_type) {
        query = query.eq('report_type', toolInput.report_type);
      }

      if (toolInput.query) {
        query = query.or(`summary.ilike.%${toolInput.query}%,content.ilike.%${toolInput.query}%`);
      }

      const limit = toolInput.limit || 10;
      query = query.limit(limit);

      const { data: reports, error: searchError } = await query;

      if (searchError) {
        return { success: false, error: searchError.message };
      }
      return { success: true, reports };

    case 'write_report':
      const { data: report, error: writeError } = await supabase
        .from('barry_reports')
        .insert({
          report_type: toolInput.report_type,
          summary: toolInput.summary,
          content: toolInput.content,
          metadata: toolInput.metadata ? JSON.parse(toolInput.metadata) : null
        })
        .select()
        .single();

      if (writeError) {
        return { success: false, error: writeError.message };
      }
      return { success: true, report };

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

/**
 * Get a session by ID
 * @param {string} sessionId - Session ID
 * @returns {Object} Session data
 */
async function getSession(sessionId) {
  const { data, error } = await supabase
    .from('barry_chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Session not found');
  }

  return data;
}

/**
 * List recent sessions for a user
 * @param {string} userId - User ID
 * @returns {Array} List of sessions
 */
async function listSessions(userId) {
  const { data, error } = await supabase
    .from('barry_chat_sessions')
    .select('id, conversation_type, messages, status, created_at, summary')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('🎩 [Barry Chat] Error listing sessions:', error);
    return [];
  }

  // Extract first message preview
  return data.map(session => ({
    id: session.id,
    conversationType: session.conversation_type,
    firstMessage: session.messages?.[0]?.content?.substring(0, 100) || '',
    status: session.status,
    createdAt: session.created_at,
    summary: session.summary
  }));
}

module.exports = {
  startSession,
  sendMessage,
  getSession,
  listSessions
};
