# Barry COO

Autonomous AI Operations Agent for Mythweaver

## Overview

Barry is an always-on AI operations agent that manages Mythweaver autonomously. He runs scheduled tasks against the production database, monitors the generation pipeline, tracks costs and engagement, audits the AI market for better tools, and reports findings through a dashboard interface.

## Architecture

- **Brain**: Claude API wrapper for all LLM calls
- **Scheduler**: Cron-based task runner that reads configs from Supabase
- **Memory**: Persistent storage in Supabase (tasks, reports, escalations, long-term context)
- **Tools**: Read-only SQL, memory updates, escalation creation

## Setup

1. Copy `.env.example` to `.env` and fill in the values
2. Install dependencies: `npm install`
3. Run in development: `npm run dev`
4. Run in production: `npm start`
5. Run tests: `npm test`

## Deployment

Barry deploys as a separate service on Railway alongside the Mythweaver API. Push to main branch to auto-deploy.

## Environment Variables

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_KEY`: Service role key for database access
- `ANTHROPIC_API_KEY`: Claude API key
- `PORT`: Server port (default 3001)
- `ALLOWED_EMAILS`: Comma-separated list of emails allowed to access Barry endpoints
- `MYTHWEAVER_API_URL`: URL of the main Mythweaver API service

## Scheduled Tasks

Tasks are stored in the `barry_task_configs` table in Supabase. Initial tasks:

- **Daily Briefing** (6 AM MT): Costs, engagement, errors, quality metrics
- **Weekly AI Audit** (8 AM MT Fridays): Model pricing, deprecation notices, optimization opportunities

## Database Tables

- `barry_task_configs`: Scheduled task definitions
- `barry_reports`: Task execution outputs
- `barry_escalations`: Items requiring Steven's attention
- `barry_memory`: Long-term key-value storage
- `barry_persona_evolution`: Personality parameter changes over time
- `barry_chat_sessions`: Future chat interface conversations (Phase 2)
