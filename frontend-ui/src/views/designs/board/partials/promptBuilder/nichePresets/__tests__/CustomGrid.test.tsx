// PROJ-34 Phase 13t-k — CustomGrid unit tests.
// Covers: loading skeletons, empty-state Alert (AC-106), error Alert,
// happy-path rendering with promoter chip (AC-104), delete confirm-flow
// (AC-103) — window.confirm true → mutation + success toast, false → skipped.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import { presetCardsApi } from '@/services/presetCardsApi';
import type { NichePresetCard } from '@/types/nichePreset';
import CustomGrid from '../CustomGrid';

const buildCustomCard = (
  overrides: Partial<NichePresetCard> = {},
): NichePresetCard => ({
  id: 'preset-c1',
  preset_label: 'Custom Card A',
  preset_hash: 'hash-custom',
  slots: {
    spatial_configuration: 'centered',
    visual_description: 'desc',
    typography_adjectives: 'adj',
    font_combination: 'pair',
    accessories: '',
    style_dna: 'dna',
    extra_context: '',
  },
  raw_flags: {
    spatial_configuration: false,
    visual_description: false,
    typography_adjectives: false,
    font_combination: false,
    accessories: false,
    style_dna: false,
    extra_context: false,
  },
  source: {
    card_type: 'top',
    references: [{ niche_id: 'n1', product_ids: ['p1'] }],
  },
  reference_thumbnail_url: 'https://example.test/thumb.webp',
  is_in_history: true,
  is_in_custom: true,
  custom_promoted_by: 'user-mario-12345',
  custom_promoted_at: '2026-05-18T11:00:00Z',
  last_clicked_at: '2026-05-18T10:00:00Z',
  created_at: '2026-05-18T09:00:00Z',
  ...overrides,
});

const mockState: {
  data: NichePresetCard[] | undefined;
  isLoading: boolean;
  isError: boolean;
  remove: ReturnType<typeof vi.fn>;
  removing: boolean;
} = {
  data: undefined,
  isLoading: false,
  isError: false,
  remove: vi.fn(),
  removing: false,
};

vi.mock('@/services/presetCardsApi', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/presetCardsApi')>(
      '@/services/presetCardsApi',
    );
  return {
    ...actual,
    useGetCustomQuery: () => ({
      data: mockState.data,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
    useRemoveCustomMutation: () => [
      mockState.remove,
      { isLoading: mockState.removing },
    ],
  };
});

const renderGrid = () =>
  renderWithProviders(<CustomGrid />, {
    reducers: { [presetCardsApi.reducerPath]: presetCardsApi.reducer },
  });

beforeEach(() => {
  mockState.data = undefined;
  mockState.isLoading = false;
  mockState.isError = false;
  mockState.removing = false;
  mockState.remove = vi.fn().mockReturnValue({
    unwrap: () => Promise.resolve({}),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CustomGrid (PROJ-34 Phase 13t-k)', () => {
  it('renders skeleton tiles while loading', () => {
    mockState.isLoading = true;
    const { container } = renderGrid();
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBe(6);
  });

  it('renders the error Alert on query failure', () => {
    mockState.isError = true;
    renderGrid();
    expect(
      screen.getByText(/could not load suggestions/i),
    ).toBeInTheDocument();
  });

  it('renders the empty-state Alert when no custom entries exist (AC-106)', () => {
    mockState.data = [];
    renderGrid();
    expect(
      screen.getByText(
        /save history entries to custom to keep them permanently/i,
      ),
    ).toBeInTheDocument();
  });

  it('renders the promoter chip with truncated id (AC-104)', () => {
    mockState.data = [buildCustomCard()];
    renderGrid();
    // 'user-mar' is first 8 chars of 'user-mario-12345'
    expect(screen.getByText(/Promoted by user-mar/i)).toBeInTheDocument();
  });

  it('renders "unknown" attribution when custom_promoted_by is null', () => {
    mockState.data = [
      buildCustomCard({ custom_promoted_by: null }),
    ];
    renderGrid();
    expect(screen.getByText(/Promoted by unknown/i)).toBeInTheDocument();
  });

  it('fires removeCustom + info toast when delete confirmed (AC-103)', async () => {
    mockState.data = [buildCustomCard()];
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    renderGrid();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    });
    expect(mockState.remove).toHaveBeenCalledWith({ presetId: 'preset-c1' });
    expect(await screen.findByText(/^removed\.$/i)).toBeInTheDocument();
  });

  it('skips mutation when window.confirm returns false', () => {
    mockState.data = [buildCustomCard()];
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    renderGrid();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(mockState.remove).not.toHaveBeenCalled();
  });

  it('shows error toast when remove mutation rejects', async () => {
    mockState.data = [buildCustomCard()];
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    mockState.remove = vi.fn().mockReturnValue({
      unwrap: () => Promise.reject(new Error('boom')),
    });
    renderGrid();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    });
    expect(await screen.findByText(/remove failed/i)).toBeInTheDocument();
  });
});
