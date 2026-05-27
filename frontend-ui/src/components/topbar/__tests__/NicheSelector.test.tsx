import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../utils/test-utils';
import chatBarReducer, { setActiveNicheId } from '@/store/chatBarSlice';
import NicheSelector from '../NicheSelector';

const mockListNiches = vi.fn();
vi.mock('@/store/nicheSlice', () => ({
  nicheApi: {
    reducerPath: 'nicheApi',
    reducer: () => ({}),
    middleware: () => (next: unknown) => (a: unknown) => (next as (x: unknown) => unknown)(a),
  },
  useListNichesQuery: (...args: unknown[]) => mockListNiches(...(args as [])),
}));

const NICHES = [
  { id: 'n-1', name: 'school bus driver' },
  { id: 'n-2', name: 'bingo caller shirt' },
];

beforeEach(() => {
  mockListNiches.mockReset();
});

describe('NicheSelector', () => {
  it('shows placeholder when no active niche', () => {
    mockListNiches.mockReturnValue({ data: { results: NICHES }, isFetching: false });
    renderWithProviders(<NicheSelector />, {
      reducers: { chatBar: chatBarReducer },
      preloadedState: { workspace: { activeWorkspaceId: 'ws-1' } },
    });
    expect(screen.getByTestId('topbar-niche-selector')).toHaveTextContent('Niche');
  });

  it('shows the active niche label when one is set', async () => {
    mockListNiches.mockReturnValue({ data: { results: NICHES }, isFetching: false });
    const { store } = renderWithProviders(<NicheSelector />, {
      reducers: { chatBar: chatBarReducer },
      preloadedState: { workspace: { activeWorkspaceId: 'ws-1' } },
    });
    store.dispatch(setActiveNicheId('n-1'));
    expect(
      await screen.findByText('school bus driver'),
    ).toBeInTheDocument();
  });

  it('selecting a niche dispatches setActiveNicheId without opening the drawer (Q1A)', () => {
    mockListNiches.mockReturnValue({ data: { results: NICHES }, isFetching: false });
    const { store } = renderWithProviders(<NicheSelector />, {
      reducers: { chatBar: chatBarReducer },
      preloadedState: { workspace: { activeWorkspaceId: 'ws-1' } },
    });
    fireEvent.click(screen.getByTestId('topbar-niche-selector'));
    fireEvent.click(screen.getByText('bingo caller shirt'));
    const state = store.getState() as { chatBar: { activeNicheId: string | null; drawerOpen: boolean } };
    expect(state.chatBar.activeNicheId).toBe('n-2');
    // Q1A — pure context setter: drawer stays closed.
    expect(state.chatBar.drawerOpen).toBe(false);
  });

  it('shows the empty state when the workspace has no niches', () => {
    mockListNiches.mockReturnValue({ data: { results: [] }, isFetching: false });
    renderWithProviders(<NicheSelector />, {
      reducers: { chatBar: chatBarReducer },
      preloadedState: { workspace: { activeWorkspaceId: 'ws-1' } },
    });
    fireEvent.click(screen.getByTestId('topbar-niche-selector'));
    expect(screen.getByText('No niches')).toBeInTheDocument();
  });
});
