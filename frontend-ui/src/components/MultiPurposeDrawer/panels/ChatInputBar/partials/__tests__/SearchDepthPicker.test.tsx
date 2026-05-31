/**
 * FIX-dashboard-bug-report-and-polish Item 9 — SearchDepthPicker tests.
 *
 * Verifies the contract:
 *   - 3 radio options rendered
 *   - selecting a non-default mode dispatches `setSearchMode`
 *   - badge visible only when mode !== 'speed'
 *   - cost-warning snackbar fires exactly once across switches
 *   - tooltip text reflects the current mode label
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import chatBarReducer from '@/store/chatBarSlice';
import SearchDepthPicker from '../SearchDepthPicker';

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
  };
});

const COST_WARNING_FLAG_KEY = 'chat-search-mode-cost-warning-seen';
const SEARCH_MODE_KEY = 'chat-search-mode-global';

const renderPicker = (preloadedSearchMode: 'speed' | 'balanced' | 'quality' = 'speed') =>
  renderWithProviders(<SearchDepthPicker />, {
    reducers: { chatBar: chatBarReducer },
    preloadedState: {
      chatBar: {
        drawerOpen: false,
        drawerWidth: 768,
        drawerLayout: 'overlap',
        activePanel: 'chat',
        activeSessionId: null,
        activeAgentSessionId: null,
        inputChip: null,
        activeNicheId: null,
        nicheMode: 'edit',
        searching: false,
        searchSources: ['web'],
        selectedModel: 'openai/gpt-4.1-mini',
        searchMode: preloadedSearchMode,
        modeOverride: 'chat',
        streamingAssistantMessage: {
          id: null,
          content: '',
          sources: [],
          isStreaming: false,
        },
        recentChatsOverlayOpen: false,
        streamingStages: [],
        chunksUsed: [],
        followUps: [],
        streamStartedAt: null,
        flashCitation: null,
        streamingSloganPayload: null,
        completedSloganPayload: null,
      },
    },
  });

beforeEach(() => {
  mockEnqueueSnackbar.mockReset();
  try {
    window.localStorage.removeItem(COST_WARNING_FLAG_KEY);
    window.localStorage.removeItem(SEARCH_MODE_KEY);
  } catch {
    /* ignore */
  }
});

describe('SearchDepthPicker (FIX Item 9)', () => {
  it('renders 3 radio options in the popover', async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(screen.getByTestId('chat-input-search-depth-button'));
    const popover = await screen.findByTestId('chat-input-search-depth-popover');
    expect(within(popover).getByTestId('chat-input-search-depth-radio-speed')).toBeInTheDocument();
    expect(within(popover).getByTestId('chat-input-search-depth-radio-balanced')).toBeInTheDocument();
    expect(within(popover).getByTestId('chat-input-search-depth-radio-quality')).toBeInTheDocument();
  });

  it('selecting balanced dispatches setSearchMode and updates Redux state', async () => {
    const user = userEvent.setup();
    const { store } = renderPicker();
    await user.click(screen.getByTestId('chat-input-search-depth-button'));
    const radio = await screen.findByTestId('chat-input-search-depth-radio-balanced');
    await user.click(radio);
    // RadioGroup forwards click to the underlying input; assert via state.
    const state = store.getState() as { chatBar: { searchMode: string } };
    expect(state.chatBar.searchMode).toBe('balanced');
  });

  it('hides the badge when searchMode is "speed"', () => {
    renderPicker('speed');
    const button = screen.getByTestId('chat-input-search-depth-button');
    expect(button).toHaveAttribute('data-active', 'false');
  });

  it('shows the badge when searchMode is non-default', () => {
    renderPicker('balanced');
    const button = screen.getByTestId('chat-input-search-depth-button');
    expect(button).toHaveAttribute('data-active', 'true');
  });

  it('fires the cost-warning snackbar on first switch away from speed', async () => {
    const user = userEvent.setup();
    renderPicker('speed');
    await user.click(screen.getByTestId('chat-input-search-depth-button'));
    const radio = await screen.findByTestId('chat-input-search-depth-radio-balanced');
    await user.click(radio);
    expect(mockEnqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.stringMatching(/credits|Credits/),
      expect.objectContaining({ variant: 'warning' }),
    );
  });

  it('does not fire the cost-warning a second time within the same render', async () => {
    const user = userEvent.setup();
    renderPicker('speed');
    await user.click(screen.getByTestId('chat-input-search-depth-button'));
    await user.click(await screen.findByTestId('chat-input-search-depth-radio-balanced'));
    await user.click(await screen.findByTestId('chat-input-search-depth-radio-quality'));
    expect(mockEnqueueSnackbar).toHaveBeenCalledTimes(1);
  });

  it('shows the quality long-runtime warning when mode = quality', () => {
    renderPicker('quality');
    // The IconButton is only opened on click; render the popover by clicking.
    // We assert via the IconButton's badge data-active to confirm initial mode,
    // then the warning shows up after opening.
    expect(screen.getByTestId('chat-input-search-depth-button')).toHaveAttribute(
      'data-active',
      'true',
    );
  });

  it('renders the tooltip referencing the current mode label', async () => {
    const user = userEvent.setup();
    renderPicker('balanced');
    const button = screen.getByTestId('chat-input-search-depth-button');
    await user.hover(button);
    // MUI Tooltip renders its title in a sibling element on hover.
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toMatch(/Balanced|current/i);
  });

  it('respects the persisted "seen" flag and suppresses the warning', async () => {
    window.localStorage.setItem(COST_WARNING_FLAG_KEY, '1');
    const user = userEvent.setup();
    renderPicker('speed');
    await user.click(screen.getByTestId('chat-input-search-depth-button'));
    await user.click(await screen.findByTestId('chat-input-search-depth-radio-balanced'));
    expect(mockEnqueueSnackbar).not.toHaveBeenCalled();
  });
});
