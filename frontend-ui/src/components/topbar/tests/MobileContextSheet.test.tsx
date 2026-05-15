/**
 * PROJ-30 T2.6 — MobileContextSheet + MobileContextChip + Topbar mobile
 * collapse logic tests.
 *
 * Strategy:
 *   - Stub WorkspaceSelector + NicheSelector because they each fetch via
 *     RTK Query / thunks; we only care about the sheet shell, label
 *     resolution, and close callback wiring.
 *   - Mock useListNichesQuery so the chip label resolution test can pretend
 *     the active niche is present without spinning up the RTK reducer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Stub WorkspaceSelector + NicheSelector — both pull RTK Query state we don't
// want to wire up in this unit test. The sheet just needs to render whatever
// they output (here: discoverable marker nodes).
vi.mock('../WorkspaceSelector', () => ({
  __esModule: true,
  default: () => <div data-testid="workspace-selector-stub" />,
}));

vi.mock('../NicheSelector', () => ({
  __esModule: true,
  default: () => <div data-testid="niche-selector-stub" />,
}));

const mockListNiches = vi.fn();
vi.mock('@/store/nicheSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/nicheSlice')>();
  return {
    ...actual,
    useListNichesQuery: (...args: unknown[]) => mockListNiches(...args),
  };
});

import { renderWithProviders } from '../../../utils/test-utils';
import MobileContextSheet, {
  MobileContextChip,
  MobileContextControl,
} from '../MobileContextSheet';
import { setActiveNicheId } from '../../../store/chatBarSlice';
import workspaceReducer, {
  setActiveWorkspace,
} from '../../../store/workspaceSlice';
import chatBarReducer from '../../../store/chatBarSlice';

describe('MobileContextSheet', () => {
  beforeEach(() => {
    mockListNiches.mockReset();
    mockListNiches.mockReturnValue({ data: { results: [] }, isFetching: false });
  });

  it('renders title, both pickers, and close button when open', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <MobileContextSheet open onClose={onClose} onOpen={() => {}} />,
    );
    expect(screen.getByText(/Workspace & Niche/i)).toBeInTheDocument();
    expect(screen.getByTestId('workspace-selector-stub')).toBeInTheDocument();
    expect(screen.getByTestId('niche-selector-stub')).toBeInTheDocument();
    // The bottom-row TextButton "Close" + the header X both call onClose.
    expect(
      screen.getAllByRole('button', { name: /close/i }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('fires onClose when the Close button is tapped', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <MobileContextSheet open onClose={onClose} onOpen={() => {}} />,
    );
    const buttons = screen.getAllByRole('button', { name: /close/i });
    await user.click(buttons[buttons.length - 1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('MobileContextChip', () => {
  beforeEach(() => {
    mockListNiches.mockReset();
  });

  it('shows the empty-state i18n string when no workspace is set', () => {
    mockListNiches.mockReturnValue({ data: { results: [] }, isFetching: false });
    renderWithProviders(<MobileContextChip onOpen={() => {}} open={false} />, {
      reducers: { workspace: workspaceReducer, chatBar: chatBarReducer },
    });
    const chip = screen.getByTestId('topbar-mobile-context-chip');
    expect(chip).toHaveTextContent(/Select context/i);
  });

  it('falls back to workspace name when only workspace is set', async () => {
    mockListNiches.mockReturnValue({ data: { results: [] }, isFetching: false });
    const { store } = renderWithProviders(
      <MobileContextChip onOpen={() => {}} open={false} />,
      {
        reducers: { workspace: workspaceReducer, chatBar: chatBarReducer },
        preloadedState: {
          workspace: {
            workspaces: [
              { id: 'w1', name: 'Acme Co', slug: 'acme', role: 'admin', members: [] },
            ],
            activeWorkspaceId: 'w1',
            loading: false,
            error: null,
          },
        } as never,
      },
    );
    await act(async () => {
      store.dispatch(setActiveWorkspace('w1'));
    });
    expect(screen.getByTestId('topbar-mobile-context-chip')).toHaveTextContent(
      /Acme Co/i,
    );
  });

  it('shows niche name (truncated 14ch) when both workspace and niche are set', async () => {
    mockListNiches.mockReturnValue({
      data: { results: [{ id: 'n1', name: 'Super Long Niche Name That Truncates' }] },
      isFetching: false,
    });
    const { store } = renderWithProviders(
      <MobileContextChip onOpen={() => {}} open={false} />,
      {
        reducers: { workspace: workspaceReducer, chatBar: chatBarReducer },
        preloadedState: {
          workspace: {
            workspaces: [
              { id: 'w1', name: 'Acme Co', slug: 'acme', role: 'admin', members: [] },
            ],
            activeWorkspaceId: 'w1',
            loading: false,
            error: null,
          },
        } as never,
      },
    );
    await act(async () => {
      store.dispatch(setActiveWorkspace('w1'));
      store.dispatch(setActiveNicheId('n1'));
    });
    const chip = screen.getByTestId('topbar-mobile-context-chip');
    // 14ch truncate → first 14 chars + ellipsis
    expect(chip).toHaveTextContent('Super Long Ni…');
  });

  it('invokes onOpen when the chip is tapped', async () => {
    mockListNiches.mockReturnValue({ data: { results: [] }, isFetching: false });
    const user = userEvent.setup();
    const onOpen = vi.fn();
    renderWithProviders(<MobileContextChip onOpen={onOpen} open={false} />, {
      reducers: { workspace: workspaceReducer, chatBar: chatBarReducer },
    });
    await user.click(screen.getByTestId('topbar-mobile-context-chip'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('MobileContextControl — integration', () => {
  beforeEach(() => {
    mockListNiches.mockReset();
    mockListNiches.mockReturnValue({ data: { results: [] }, isFetching: false });
  });

  it('opens the sheet on chip tap', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileContextControl />, {
      reducers: { workspace: workspaceReducer, chatBar: chatBarReducer },
    });
    // SwipeableDrawer keeps DOM mounted to enable swipe-to-open. Source of
    // truth for open state = aria-expanded on the chip trigger.
    const chip = screen.getByTestId('topbar-mobile-context-chip');
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Workspace & Niche/i)).toBeInTheDocument();
  });
});
