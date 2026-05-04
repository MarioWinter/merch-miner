/**
 * PROJ-17 Phase 6 — WorkflowCard tests (P1)
 *
 * Strategy: stub agentSlice so useGetSessionQuery/useListTemplatesQuery return
 * controlled data per test. Mock ApprovalCard and useApproval to isolate the
 * card's inline logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

// ---- hoisted mocks ----
const {
  mockUseGetSessionQuery,
  mockUseListTemplatesQuery,
  mockApprove,
  mockReject,
} = vi.hoisted(() => ({
  mockUseGetSessionQuery: vi.fn(),
  mockUseListTemplatesQuery: vi.fn(),
  mockApprove: vi.fn(),
  mockReject: vi.fn(),
}));

vi.mock('@/store/agentSlice', () => ({
  agentApi: {
    reducerPath: 'agentApi',
    util: { invalidateTags: vi.fn(() => ({ type: 'noop' })) },
  },
  useGetSessionQuery: (...args: unknown[]) => mockUseGetSessionQuery(...args),
  useListTemplatesQuery: (...args: unknown[]) => mockUseListTemplatesQuery(...args),
  useApproveActionMutation: () => [vi.fn(), { isLoading: false }],
  useRejectActionMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('../AgentPanel/hooks/useApproval', () => ({
  default: () => ({
    approve: mockApprove,
    reject: mockReject,
    approving: false,
    rejecting: false,
  }),
}));

vi.mock('../ApprovalCard', () => ({
  default: () => <div data-testid="approval-card-mock" />,
}));

// ---- imports of code under test ----
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { CssVarsProvider } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../../../../../public/locales/en/translation.json';
import chatBarReducer from '@/store/chatBarSlice';
import theme from '@/style/theme';
import WorkflowCard from '../WorkflowCard';
import type { ChatMessageAgentSessionRef } from '@/types/search';
import type {
  AgentSessionDetail,
  WorkflowTemplate,
  SessionStatus,
} from '../AgentPanel/types';

// ---- i18n bootstrap ----
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: enTranslation } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

// ---- store factory ----
const buildStore = () =>
  configureStore({ reducer: { chatBar: chatBarReducer } });

const renderCard = (sessionRef: ChatMessageAgentSessionRef) => {
  const store = buildStore();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <CssVarsProvider theme={theme} defaultMode="dark">
        <SnackbarProvider maxSnack={4}>
          <MemoryRouter>{children}</MemoryRouter>
        </SnackbarProvider>
      </CssVarsProvider>
    </Provider>
  );
  return {
    store,
    ...render(<WorkflowCard agentSessionRef={sessionRef} />, { wrapper: Wrapper }),
  };
};

// ---- helpers ----
const sessionRef = (overrides: Partial<ChatMessageAgentSessionRef> = {}): ChatMessageAgentSessionRef => ({
  id: 'sess-1',
  status: 'running',
  current_step: 'analyze',
  completed_steps: 1,
  total_steps: 5,
  ...overrides,
});

const buildSession = (overrides: Partial<AgentSessionDetail> = {}): AgentSessionDetail => ({
  id: 'sess-1',
  workspace: 'ws-1',
  created_by: 'u1',
  created_by_email: 'mario@example.com',
  created_by_username: 'mario',
  title: 'Niche Workflow',
  status: 'running',
  niche_context: null,
  workflow_template: null,
  autonomy_preset: 'balanced',
  is_shared: false,
  current_step: 'analyze',
  total_steps: 5,
  completed_steps: 1,
  error_message: '',
  batch_id: null,
  batch_position: null,
  message_count: 0,
  progress: {
    current_step: 'analyze',
    completed_steps: 1,
    total_steps: 5,
    percent: 20,
  },
  created_at: '2026-04-25T00:00:00Z',
  updated_at: '2026-04-25T00:00:00Z',
  completed_at: null,
  messages: [],
  action_logs: [],
  ...overrides,
});

const buildTemplate = (steps: WorkflowTemplate['steps']): WorkflowTemplate => ({
  id: 'tpl-1',
  workspace: 'ws-1',
  created_by: null,
  name: 'Niche Research',
  key: 'niche_research',
  is_system: true,
  steps,
  steps_with_descriptions: steps.map((s) => ({ ...s, description: s.description })),
  created_at: '2026-04-25T00:00:00Z',
});

beforeEach(() => {
  vi.clearAllMocks();
  // default mocks — running session, no template, no approvals
  mockUseGetSessionQuery.mockReturnValue({
    data: buildSession(),
    isLoading: false,
  });
  mockUseListTemplatesQuery.mockReturnValue({ data: [] });
});

describe('WorkflowCard', () => {
  it('renders status chip for current session status', () => {
    mockUseGetSessionQuery.mockReturnValue({
      data: buildSession({ status: 'idle' }),
      isLoading: false,
    });
    renderCard(sessionRef({ status: 'idle' }));
    // Chip text comes from i18n "search.workflow.status.idle" with fallback to "idle"
    const chips = screen.getAllByText(/idle/i);
    expect(chips.length).toBeGreaterThan(0);
  });

  it('calls useGetSessionQuery with pollingInterval=3000 when status is running', () => {
    renderCard(sessionRef({ status: 'running' }));
    expect(mockUseGetSessionQuery).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({ pollingInterval: 3000 }),
    );
  });

  it('calls useGetSessionQuery with pollingInterval=0 when status is terminal (completed)', () => {
    mockUseGetSessionQuery.mockReturnValue({
      data: buildSession({ status: 'completed' }),
      isLoading: false,
    });
    renderCard(sessionRef({ status: 'completed' }));
    expect(mockUseGetSessionQuery).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({ pollingInterval: 0 }),
    );
  });

  it('renders step progress text "1/5" from session data', () => {
    mockUseGetSessionQuery.mockReturnValue({
      data: buildSession({ completed_steps: 1, total_steps: 5 }),
      isLoading: false,
    });
    renderCard(sessionRef({ completed_steps: 1, total_steps: 5 }));
    expect(screen.getByText(/1\/5/)).toBeInTheDocument();
  });

  it('renders LinearProgress when no workflow_template is set (no steps to render)', () => {
    mockUseGetSessionQuery.mockReturnValue({
      data: buildSession({ workflow_template: null }),
      isLoading: false,
    });
    const { container } = renderCard(sessionRef());
    // MUI LinearProgress has class MuiLinearProgress-root
    expect(container.querySelector('.MuiLinearProgress-root')).not.toBeNull();
  });

  it('renders inline ApprovalCard when there is a pending approval', () => {
    const session = buildSession({
      messages: [
        {
          id: 'msg-1',
          session: 'sess-1',
          role: 'approval_request',
          content: 'Please approve',
          agent_type: 'orchestrator',
          agent_display_name: 'Chief',
          agent_avatar_emoji: '🤖',
          tool_calls: [
            {
              tool_name: 'noop',
              args: { action_log_id: 'log-1' },
              result: null,
              status: 'pending',
            },
          ],
          created_at: '2026-04-25T00:00:00Z',
        },
      ],
      action_logs: [
        {
          id: 'log-1',
          session: 'sess-1',
          workspace: 'ws-1',
          user: 'u1',
          agent_type: 'orchestrator',
          action: 'noop',
          target_object_type: '',
          target_object_id: null,
          status: 'awaiting_approval',
          cost_estimate: null,
          error_message: '',
          target_summary: '',
          created_at: '2026-04-25T00:00:00Z',
          completed_at: null,
        },
      ],
    });
    mockUseGetSessionQuery.mockReturnValue({ data: session, isLoading: false });
    renderCard(sessionRef());
    expect(screen.getByTestId('approval-card-mock')).toBeInTheDocument();
  });

  it('does NOT render ApprovalCard when matching action_log is already approved', () => {
    const session = buildSession({
      messages: [
        {
          id: 'msg-1',
          session: 'sess-1',
          role: 'approval_request',
          content: 'Please approve',
          agent_type: 'orchestrator',
          agent_display_name: 'Chief',
          agent_avatar_emoji: '🤖',
          tool_calls: [
            {
              tool_name: 'noop',
              args: { action_log_id: 'log-1' },
              result: null,
              status: 'pending',
            },
          ],
          created_at: '2026-04-25T00:00:00Z',
        },
      ],
      action_logs: [
        {
          id: 'log-1',
          session: 'sess-1',
          workspace: 'ws-1',
          user: 'u1',
          agent_type: 'orchestrator',
          action: 'noop',
          target_object_type: '',
          target_object_id: null,
          status: 'approved',
          cost_estimate: null,
          error_message: '',
          target_summary: '',
          created_at: '2026-04-25T00:00:00Z',
          completed_at: '2026-04-25T00:01:00Z',
        },
      ],
    });
    mockUseGetSessionQuery.mockReturnValue({ data: session, isLoading: false });
    renderCard(sessionRef());
    expect(screen.queryByTestId('approval-card-mock')).toBeNull();
  });

  it('renders the "Open Command Center" button', () => {
    renderCard(sessionRef());
    // i18n key search.workflow.openCommandCenter — value contains "Command Center"
    expect(screen.getByRole('button', { name: /command center/i })).toBeInTheDocument();
  });

  it('clicking "Open Command Center" updates Redux: activeAgentSessionId + activePanel=agent', async () => {
    const user = userEvent.setup();
    const { store } = renderCard(sessionRef({ id: 'sess-xyz' }));
    const btn = screen.getByRole('button', { name: /command center/i });
    await user.click(btn);
    const state = store.getState().chatBar;
    expect(state.activeAgentSessionId).toBe('sess-xyz');
    expect(state.activePanel).toBe('agent');
  });

  it('renders workflow steps when template is loaded (steps from useListTemplatesQuery)', () => {
    const session = buildSession({ workflow_template: 'niche_research' });
    mockUseGetSessionQuery.mockReturnValue({ data: session, isLoading: false });
    mockUseListTemplatesQuery.mockReturnValue({
      data: [
        buildTemplate([
          { agent_type: 'research', action: 'scrape', description: 'Scrape products' },
          { agent_type: 'research', action: 'analyze', description: 'Analyze data' },
        ]),
      ],
    });
    renderCard(sessionRef());
    expect(screen.getByText('Scrape products')).toBeInTheDocument();
    expect(screen.getByText('Analyze data')).toBeInTheDocument();
  });

  it('shows skeleton when isLoading=true and no session data yet', () => {
    mockUseGetSessionQuery.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderCard(sessionRef());
    // MUI Skeleton has class MuiSkeleton-root
    expect(container.querySelector('.MuiSkeleton-root')).not.toBeNull();
  });
});

// Cast helpers — keep TS happy without losing runtime typing via partial overrides.
type _SessionStatusGuard = SessionStatus;
const _: _SessionStatusGuard = 'idle';
void _;
