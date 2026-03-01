const { BARRY_CHAT_TOOLS } = require('./chat-tools');

/**
 * Convert Anthropic tool format to OpenAI Realtime function format
 *
 * Anthropic format:
 * {
 *   name: 'execute_sql',
 *   description: '...',
 *   input_schema: { type: 'object', properties: {...}, required: [...] }
 * }
 *
 * OpenAI Realtime format:
 * {
 *   type: 'function',
 *   name: 'execute_sql',
 *   description: '...',
 *   parameters: { type: 'object', properties: {...}, required: [...] }
 * }
 */
function convertAnthropicToolToOpenAI(anthropicTool) {
  return {
    type: 'function',
    name: anthropicTool.name,
    description: anthropicTool.description,
    parameters: anthropicTool.input_schema
  };
}

/**
 * Get all Barry tools in OpenAI Realtime format
 * @returns {Array} Tools formatted for OpenAI Realtime API
 */
function getVoiceTools() {
  return BARRY_CHAT_TOOLS.map(convertAnthropicToolToOpenAI);
}

module.exports = {
  convertAnthropicToolToOpenAI,
  getVoiceTools
};
