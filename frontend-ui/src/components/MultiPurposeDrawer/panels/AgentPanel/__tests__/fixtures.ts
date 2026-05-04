/**
 * PROJ-18 Phase 10 — Shared test fixtures for AgentPanel tests.
 */
import type {
  AgentSessionDetail,
  AgentMessage,
  AgentActionLog,
  WorkflowStep,
  SessionStatus,
} from '@/types/agent';

export const buildSession = (
  overrides: Partial<AgentSessionDetail> = {},
): AgentSessionDetail => ({
  id: 'sess-1',
  workspace: 'ws-1',
  created_by: 'u1',
  created_by_email: 'mario@example.com',
  created_by_username: 'mario',
  title: 'Test Session',
  status: 'idle' as SessionStatus,
  niche_context: null,
  workflow_template: null,
  autonomy_preset: 'balanced',
  is_shared: false,
  current_step: '',
  total_steps: 0,
  completed_steps: 0,
  error_message: '',
  batch_id: null,
  batch_position: null,
  message_count: 0,
  progress: {
    current_step: '',
    completed_steps: 0,
    total_steps: 0,
    percent: 0,
  },
  created_at: '2026-04-29T00:00:00Z',
  updated_at: '2026-04-29T00:00:00Z',
  completed_at: null,
  messages: [],
  action_logs: [],
  ...overrides,
});

export const buildMessage = (
  overrides: Partial<AgentMessage> = {},
): AgentMessage => ({
  id: 'msg-1',
  session: 'sess-1',
  role: 'agent',
  content: 'Hello from Chief',
  agent_type: 'orchestrator',
  agent_display_name: 'Chief',
  agent_avatar_emoji: '\u{1F916}',
  tool_calls: [],
  created_at: '2026-04-29T00:00:00Z',
  ...overrides,
});

export const buildApprovalRequest = (
  overrides: Partial<AgentMessage> = {},
): AgentMessage =>
  buildMessage({
    id: 'approval-msg-1',
    role: 'approval_request',
    content: 'Approve generating 10 designs?',
    tool_calls: [
      {
        tool_name: 'generate_design',
        args: { action_log_id: 'log-1', cost_estimate: '0.05' },
        result: null,
        status: 'pending',
      },
    ],
    ...overrides,
  });

export const buildActionLog = (
  overrides: Partial<AgentActionLog> = {},
): AgentActionLog => ({
  id: 'log-1',
  session: 'sess-1',
  workspace: 'ws-1',
  user: 'u1',
  agent_type: 'orchestrator',
  action: 'generate_design',
  target_object_type: 'niche',
  target_object_id: 'niche-1',
  status: 'awaiting_approval',
  cost_estimate: '0.05',
  error_message: '',
  target_summary: 'Funny Cats T-Shirt',
  created_at: '2026-04-29T00:00:00Z',
  completed_at: null,
  ...overrides,
});

export const buildSteps = (): WorkflowStep[] => [
  {
    agent_type: 'research',
    action: 'scrape',
    description: 'Scrape products',
  },
  {
    agent_type: 'ideation',
    action: 'generate_slogans',
    description: 'Generate slogans',
  },
  {
    agent_type: 'design',
    action: 'create_design',
    description: 'Create design',
  },
];
