import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type { MbaColor } from '../types';

// ---------------------------------------------------------------------------
// Mocks — RTK Query hook for MBA colors (F2 backend endpoint)
// ---------------------------------------------------------------------------
//
// G2 smoke test: verify ColorGrid renders correctly through the
// loading → success pipeline once the F2 `/api/mba/colors/` endpoint lands.
// We stub the hook instead of spinning up MSW because the only surface under
// test here is the ColorGrid branching, not axios wiring.

type QueryResult = {
  data: MbaColor[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

const mockQueryResult: QueryResult = {
  data: undefined,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

vi.mock('@/store/publishSlice', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/store/publishSlice')>();
  return {
    ...actual,
    useGetMbaColorsQuery: () => mockQueryResult,
  };
});

import ColorGrid from '../partials/edit/ColorGrid';

// ---------------------------------------------------------------------------
// Fixtures — subset of the canonical MBA palette served by `/api/mba/colors/`
// ---------------------------------------------------------------------------

const MBA_COLORS_FIXTURE: MbaColor[] = [
  { key: 'black', name: 'Black', hex: '#000000' },
  { key: 'white', name: 'White', hex: '#FFFFFF' },
  { key: 'navy', name: 'Navy', hex: '#0E1E3A' },
];

const setQueryState = (state: Partial<QueryResult>) => {
  Object.assign(mockQueryResult, {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...state,
  });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ColorGrid — G2 backend verification smoke test', () => {
  beforeEach(() => {
    setQueryState({});
  });

  it('renders 20 skeleton circles while loading', () => {
    setQueryState({ isLoading: true });
    const { container } = renderWithProviders(
      <ColorGrid selected={[]} onChange={vi.fn()} onOptionsClick={vi.fn()} />,
    );

    const busyRegion = container.querySelector('[aria-busy="true"]');
    expect(busyRegion).toBeInTheDocument();
    // Skeletons render as MUI pulse placeholders
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBe(20);
    // Live swatch grid must not render yet
    expect(screen.queryByRole('group', { name: /colors/i })).not.toBeInTheDocument();
  });

  it('renders real color swatches once F2 endpoint resolves', () => {
    setQueryState({ data: MBA_COLORS_FIXTURE });
    renderWithProviders(
      <ColorGrid selected={[]} onChange={vi.fn()} onOptionsClick={vi.fn()} />,
    );

    const grid = screen.getByRole('group', { name: /colors/i });
    expect(grid).toBeInTheDocument();

    const swatches = screen.getAllByRole('checkbox');
    expect(swatches).toHaveLength(MBA_COLORS_FIXTURE.length);

    // Swatch aria-labels derive from the hex/name payload the backend returned
    expect(screen.getByRole('checkbox', { name: /black/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /white/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /navy/i })).toBeInTheDocument();
  });

  it('marks selected swatches via aria-checked (preselected state)', () => {
    setQueryState({ data: MBA_COLORS_FIXTURE });
    renderWithProviders(
      <ColorGrid
        selected={['black', 'navy']}
        onChange={vi.fn()}
        onOptionsClick={vi.fn()}
      />,
    );

    expect(screen.getByRole('checkbox', { name: /black/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('checkbox', { name: /white/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('checkbox', { name: /navy/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('invokes onChange with toggled key when a swatch is clicked', () => {
    setQueryState({ data: MBA_COLORS_FIXTURE });
    const onChange = vi.fn();
    renderWithProviders(
      <ColorGrid
        selected={['black']}
        onChange={onChange}
        onOptionsClick={vi.fn()}
      />,
    );

    // Adding navy appends to existing selection
    fireEvent.click(screen.getByRole('checkbox', { name: /navy/i }));
    expect(onChange).toHaveBeenCalledWith(['black', 'navy']);

    // Re-clicking a selected swatch removes it
    fireEvent.click(screen.getByRole('checkbox', { name: /black/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('renders error alert with retry when the endpoint fails', () => {
    const refetch = vi.fn();
    setQueryState({ isError: true, refetch });
    renderWithProviders(
      <ColorGrid selected={[]} onChange={vi.fn()} onOptionsClick={vi.fn()} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/failed to load colors/i);
    const retry = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retry);
    expect(refetch).toHaveBeenCalledTimes(1);

    // No color grid rendered during error
    expect(screen.queryByRole('group', { name: /colors/i })).not.toBeInTheDocument();
  });

  it('does not render stale empty-state placeholder when data is absent', () => {
    // Pre-load, cache-empty: hook returns data=undefined, not-loading, not-error.
    // RTK Query emits this state briefly on mount; ColorGrid must render
    // nothing (no "No colors configured yet" dead branch).
    setQueryState({ data: undefined });
    renderWithProviders(
      <ColorGrid selected={[]} onChange={vi.fn()} onOptionsClick={vi.fn()} />,
    );

    expect(screen.queryByText(/no colors configured/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /colors/i })).not.toBeInTheDocument();
  });
});
