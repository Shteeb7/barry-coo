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
  },
  {
    name: 'queue_task',
    description: 'Queue a task for Barry\'s other mode. Use when the current mode lacks the tools needed. Railway-Barry queues tasks requiring Google Drive, Gmail, Chrome, etc. for Cowork. Cowork-Barry queues reminders and follow-ups for Railway\'s scheduled tasks.',
    input_schema: {
      type: 'object',
      properties: {
        request_summary: {
          type: 'string',
          description: 'What needs to be done (1-2 sentences)'
        },
        full_context: {
          type: 'string',
          description: 'Full conversation context — why this was requested, any relevant details'
        },
        required_tools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tools needed: google_drive, gmail, calendar, chrome, imessage, pdf_tools, etc.'
        },
        priority: {
          type: 'string',
          enum: ['P0', 'P1', 'P2', 'P3'],
          description: 'P0=urgent, P1=important, P2=normal, P3=whenever'
        },
        target_mode: {
          type: 'string',
          enum: ['railway', 'cowork'],
          description: 'Which mode should process this'
        }
      },
      required: ['request_summary', 'target_mode']
    }
  },
  {
    name: 'read_queue',
    description: 'Check Barry\'s queue to see pending, completed, or failed items. Use this to review what tasks are waiting or what has been processed.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
          description: 'Filter by status (optional)'
        },
        target_mode: {
          type: 'string',
          enum: ['railway', 'cowork'],
          description: 'Filter by target mode (optional)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of items to return (default: 10)'
        }
      },
      required: []
    }
  },
  {
    name: 'complete_queue_item',
    description: 'Mark a queue item as completed or failed with results. Used by Cowork-Barry when finishing a queued task.',
    input_schema: {
      type: 'object',
      properties: {
        queue_id: {
          type: 'string',
          description: 'The UUID of the queue item to complete'
        },
        status: {
          type: 'string',
          enum: ['completed', 'failed'],
          description: 'Final status of the queue item'
        },
        result_summary: {
          type: 'string',
          description: 'Brief summary of what was done or what went wrong'
        },
        result_detail: {
          type: 'string',
          description: 'Full details of the results'
        },
        error_message: {
          type: 'string',
          description: 'Error message if status is failed'
        }
      },
      required: ['queue_id', 'status']
    }
  }
];

module.exports = { BARRY_TOOLS };
