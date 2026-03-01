/**
 * BARRY CHAT TOOLS
 *
 * Tool definitions for web chat conversations (superset of scheduled task tools)
 * Follows Anthropic tool use format
 */

const BARRY_CHAT_TOOLS = [
  // ===== EXISTING TOOLS (from tools.js) =====
  {
    name: 'execute_sql',
    description: 'Execute a read-only SQL query against the Mythweaver database. Only SELECT queries are allowed. Use this to check story counts, chapter stats, user activity, reading sessions, or any other operational data.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The SELECT query to execute'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'update_memory',
    description: 'Store or update a piece of information in Barry\'s long-term memory. Use this to remember Steven\'s preferences, context about Mythweaver, or important decisions. Memory persists across all sessions (Railway and Cowork).',
    input_schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Memory key (e.g., "steven_timezone", "preferred_task_time", "active_projects")'
        },
        value: {
          type: 'string',
          description: 'Memory value (can be JSON string for complex data)'
        },
        category: {
          type: 'string',
          enum: ['preference', 'context', 'decision', 'insight'],
          description: 'Memory category for organization'
        }
      },
      required: ['key', 'value']
    }
  },
  {
    name: 'create_escalation',
    description: 'Create an escalation to flag something that needs Steven\'s attention. Use this for critical issues, anomalies, or decisions that require human judgment.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short escalation title'
        },
        description: {
          type: 'string',
          description: 'Detailed description of the issue'
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          description: 'Escalation severity level'
        },
        category: {
          type: 'string',
          description: 'Category (e.g., "generation", "cost", "quality", "error")'
        },
        metadata: {
          type: 'string',
          description: 'Additional metadata as JSON string'
        }
      },
      required: ['title', 'description', 'severity']
    }
  },
  {
    name: 'queue_task',
    description: 'Queue a task for your other self. Use this when Steven asks for something that requires tools you don\'t have in this mode (Google Drive, Gmail, Calendar, etc.). Cowork-Barry will process it when Steven\'s laptop is on.',
    input_schema: {
      type: 'object',
      properties: {
        request_summary: {
          type: 'string',
          description: 'Brief summary of the request'
        },
        full_context: {
          type: 'string',
          description: 'Complete context and instructions for the task'
        },
        required_tools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tools needed (e.g., ["google_drive", "gmail"])'
        },
        priority: {
          type: 'string',
          enum: ['P0', 'P1', 'P2', 'P3'],
          description: 'Priority level (P0=urgent, P3=whenever)'
        },
        target_mode: {
          type: 'string',
          enum: ['railway', 'cowork'],
          description: 'Which mode should handle this (default: cowork)'
        }
      },
      required: ['request_summary', 'full_context', 'required_tools', 'priority']
    }
  },
  {
    name: 'read_queue',
    description: 'Check the task queue to see pending, in-progress, or completed items.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
          description: 'Filter by status'
        },
        target_mode: {
          type: 'string',
          enum: ['railway', 'cowork'],
          description: 'Filter by target mode'
        },
        limit: {
          type: 'number',
          description: 'Maximum items to return'
        }
      }
    }
  },
  {
    name: 'complete_queue_item',
    description: 'Mark a queue item as completed or failed after processing.',
    input_schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Queue item UUID'
        },
        status: {
          type: 'string',
          enum: ['completed', 'failed'],
          description: 'New status'
        },
        result_summary: {
          type: 'string',
          description: 'Brief result summary'
        },
        result_detail: {
          type: 'string',
          description: 'Detailed result or output'
        },
        error_message: {
          type: 'string',
          description: 'Error message if failed'
        }
      },
      required: ['id', 'status']
    }
  },

  // ===== NEW CHAT-SPECIFIC TOOLS =====
  {
    name: 'end_conversation',
    description: 'Call this when the conversation reaches a natural conclusion. Provide a summary of what was discussed, decided, or queued.',
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Summary of the conversation: key topics, decisions made, tasks queued, and next steps'
        }
      },
      required: ['summary']
    }
  },
  {
    name: 'create_task_config',
    description: 'Create a new scheduled task that will run automatically via the Railway scheduler. Use this when Steven asks to set up recurring monitoring, daily checks, or periodic reports.',
    input_schema: {
      type: 'object',
      properties: {
        task_name: {
          type: 'string',
          description: 'Unique task identifier (snake_case, e.g., "daily_stuck_check")'
        },
        description: {
          type: 'string',
          description: 'Human-readable task description'
        },
        cron_schedule: {
          type: 'string',
          description: 'Cron expression (e.g., "0 13 * * *" for 1 PM UTC daily)'
        },
        prompt_template: {
          type: 'string',
          description: 'The full prompt that will be sent to Claude when this task runs'
        },
        model: {
          type: 'string',
          description: 'Claude model to use (default: claude-sonnet-4-5-20250929)'
        },
        enabled: {
          type: 'boolean',
          description: 'Whether the task is active (default: true)'
        }
      },
      required: ['task_name', 'description', 'cron_schedule', 'prompt_template']
    }
  },
  {
    name: 'update_task_config',
    description: 'Modify an existing scheduled task configuration.',
    input_schema: {
      type: 'object',
      properties: {
        task_name: {
          type: 'string',
          description: 'Task name to update'
        },
        cron_schedule: {
          type: 'string',
          description: 'New cron schedule'
        },
        prompt_template: {
          type: 'string',
          description: 'New prompt template'
        },
        enabled: {
          type: 'boolean',
          description: 'Enable or disable the task'
        },
        model: {
          type: 'string',
          description: 'New model'
        },
        description: {
          type: 'string',
          description: 'New description'
        }
      },
      required: ['task_name']
    }
  },
  {
    name: 'search_reports',
    description: 'Search past Barry reports by keyword or report type.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keyword or phrase'
        },
        report_type: {
          type: 'string',
          description: 'Filter by report type (e.g., "daily_briefing", "weekly_audit", "ad_hoc")'
        },
        limit: {
          type: 'number',
          description: 'Maximum reports to return (default: 10)'
        }
      }
    }
  },
  {
    name: 'write_report',
    description: 'Write an ad-hoc report during the conversation (for status checks, analysis, etc.). This saves to the reports table.',
    input_schema: {
      type: 'object',
      properties: {
        report_type: {
          type: 'string',
          description: 'Report type (e.g., "ad_hoc", "status_check", "analysis")'
        },
        summary: {
          type: 'string',
          description: 'Brief summary (1-2 sentences)'
        },
        content: {
          type: 'string',
          description: 'Full report content (markdown formatted)'
        },
        metadata: {
          type: 'string',
          description: 'Additional metadata as JSON string'
        }
      },
      required: ['report_type', 'summary', 'content']
    }
  },
  {
    name: 'update_notification_settings',
    description: 'Update Barry\'s notification settings based on Steven\'s preferences. Use this when Steven asks to change how or when he receives notifications.',
    input_schema: {
      type: 'object',
      properties: {
        email_enabled: {
          type: 'boolean',
          description: 'Enable or disable all email notifications'
        },
        digest_enabled: {
          type: 'boolean',
          description: 'Enable or disable daily digest emails'
        },
        digest_time: {
          type: 'string',
          description: 'Time to send daily digest in UTC (e.g., "14:00" for 2 PM UTC)'
        },
        immediate_severities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of severities that trigger immediate emails (e.g., ["critical", "high"])'
        },
        quiet_hours_start: {
          type: 'string',
          description: 'Start of quiet hours in UTC (e.g., "04:00" for 4 AM UTC). During quiet hours, immediate notifications become digest.'
        },
        quiet_hours_end: {
          type: 'string',
          description: 'End of quiet hours in UTC (e.g., "13:00" for 1 PM UTC)'
        }
      }
    }
  }
];

module.exports = { BARRY_CHAT_TOOLS };
