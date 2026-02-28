const Anthropic = require('@anthropic-ai/sdk');
const { BARRY_CORE_IDENTITY } = require('../config/persona');
const { BARRY_TOOLS } = require('../config/tools');
const { supabase } = require('./supabase');
const { executeSql } = require('../tools/execute-sql');
const { updateMemory } = require('../tools/update-memory');
const { createEscalation } = require('../tools/create-escalation');

// Only initialize Anthropic client if not in test environment
let anthropic;
if (process.env.NODE_ENV !== 'test') {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable');
  }
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
}

// Pricing constants (per million tokens)
const PRICING = {
  'claude-sonnet-4-5-20250929': { input: 3, output: 15 },
  'claude-opus-4-6': { input: 5, output: 25 }
};

/**
 * Load dynamic persona parameters from barry_memory
 */
async function loadPersonaParameters() {
  const { data, error } = await supabase
    .from('barry_memory')
    .select('key, value')
    .eq('category', 'persona');

  if (error) {
    console.error('🎩 [Barry] Error loading persona parameters:', error);
    return {};
  }

  const params = {};
  for (const row of data || []) {
    params[row.key] = row.value;
  }

  return params;
}

/**
 * Build the full system prompt (core identity + dynamic persona parameters)
 */
async function buildSystemPrompt(taskContext = '') {
  const personaParams = await loadPersonaParameters();

  let prompt = BARRY_CORE_IDENTITY;

  // Add dynamic persona parameters
  if (Object.keys(personaParams).length > 0) {
    prompt += '\n\n## Current Personality Parameters\n';
    for (const [key, value] of Object.entries(personaParams)) {
      const paramName = key.replace('persona_', '');
      prompt += `- ${paramName}: ${JSON.stringify(value)}\n`;
    }
  }

  // Add task-specific context if provided
  if (taskContext) {
    prompt += '\n\n## Task Context\n' + taskContext;
  }

  return prompt;
}

/**
 * Execute a tool based on its name and input
 */
async function executeTool(toolName, toolInput) {
  console.log(`🧠 [Barry] Executing tool: ${toolName}`);

  switch (toolName) {
    case 'execute_sql':
      return await executeSql(toolInput.query);

    case 'update_memory':
      return await updateMemory(
        toolInput.key,
        toolInput.value,
        toolInput.category
      );

    case 'create_escalation':
      return await createEscalation(
        toolInput.title,
        toolInput.description,
        toolInput.severity,
        toolInput.source_task
      );

    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}`
      };
  }
}

/**
 * Call Claude API with tool-use loop
 *
 * @param {Object} options
 * @param {string} options.prompt - The user prompt/task
 * @param {string} options.taskName - Name of the task (for logging)
 * @param {string} options.model - Model to use (default: sonnet)
 * @param {string} options.taskContext - Additional context for system prompt
 * @returns {Object} { content, tokensIn, tokensOut, cost }
 */
async function callBarry({ prompt, taskName, model = 'claude-sonnet-4-5-20250929', taskContext = '' }) {
  const startTime = Date.now();

  console.log(`🧠 [Barry] Starting task: ${taskName} (model: ${model})`);

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(taskContext);

  // Initialize messages array
  const messages = [
    { role: 'user', content: prompt }
  ];

  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let finalContent = '';
  let conversationRounds = 0;
  const maxRounds = 10; // Prevent infinite loops

  try {
    while (conversationRounds < maxRounds) {
      conversationRounds++;

      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        tools: BARRY_TOOLS
      });

      // Track tokens
      totalTokensIn += response.usage.input_tokens;
      totalTokensOut += response.usage.output_tokens;

      // Check if we're done (no tool uses)
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
      const textBlocks = response.content.filter(block => block.type === 'text');

      // Accumulate text content
      for (const block of textBlocks) {
        finalContent += block.text;
      }

      if (toolUseBlocks.length === 0) {
        // No tools to execute, we're done
        break;
      }

      // Execute tools and prepare results
      const toolResults = [];
      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(toolUse.name, toolUse.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result)
        });
      }

      // Add assistant response and tool results to messages
      messages.push({
        role: 'assistant',
        content: response.content
      });

      messages.push({
        role: 'user',
        content: toolResults
      });
    }

    if (conversationRounds >= maxRounds) {
      console.warn(`🎩 [Barry] Hit max conversation rounds (${maxRounds}) for task: ${taskName}`);
    }

    // Calculate cost
    const pricing = PRICING[model] || PRICING['claude-sonnet-4-5-20250929'];
    const cost = (totalTokensIn * pricing.input / 1000000) + (totalTokensOut * pricing.output / 1000000);

    const elapsed = Date.now() - startTime;
    console.log(`🧠 [Barry] Task complete: ${taskName} | ${totalTokensIn.toLocaleString()} in / ${totalTokensOut.toLocaleString()} out | $${cost.toFixed(4)} | ${elapsed}ms`);

    return {
      content: finalContent.trim(),
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      cost,
      model,
      conversationRounds
    };

  } catch (error) {
    console.error(`🎩 [Barry] Error calling Claude for task ${taskName}:`, error);
    throw error;
  }
}

module.exports = { callBarry, buildSystemPrompt };
