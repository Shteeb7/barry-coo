// Tool definitions for Claude API tool-use
// Each tool maps to a handler in src/tools/

const BARRY_TOOLS = [
  {
    name: 'execute_sql',
    description: 'Execute a read-only SQL query against the Mythweaver Supabase database. Only SELECT queries are allowed. Use this to query costs, engagement, errors, pipeline status, and other operational metrics.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The SQL SELECT query to execute. Must start with SELECT (case-insensitive).'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'update_memory',
    description: 'Write or update a key-value pair in Barry\'s long-term memory (barry_memory table). Use this to persist learned context, pricing data, model info, company state, or preferences.',
    input_schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The memory key (e.g., "last_known_opus_price", "current_realtime_model")'
        },
        value: {
          type: 'string',
          description: 'The value to store (will be stored as JSONB, so use JSON format for complex data)'
        },
        category: {
          type: 'string',
          description: 'Optional category for organization (e.g., "pricing", "models", "company_state", "preferences")'
        }
      },
      required: ['key', 'value']
    }
  },
  {
    name: 'create_escalation',
    description: 'Create an escalation for Steven\'s attention. Use this when you encounter something that requires a human decision or action outside your autonomy boundaries.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Brief title describing the escalation'
        },
        description: {
          type: 'string',
          description: 'Full description of the issue and what decision/action is needed'
        },
        severity: {
          type: 'string',
          enum: ['info', 'warning', 'critical'],
          description: 'Severity level: info (FYI), warning (needs attention soon), critical (urgent)'
        },
        source_task: {
          type: 'string',
          description: 'Optional: the task name that generated this escalation'
        }
      },
      required: ['title', 'description', 'severity']
    }
  }
];

module.exports = { BARRY_TOOLS };
