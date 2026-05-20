// PROJ-34 Phase 13t-k — HistoryGrid unit tests.
// Covers: loading skeletons, empty-state Alert (AC-99), error Alert,
// happy-path rendering, promote click → mutation + success toast (AC-98),
// promote error → error toast, source-card-type chip + "+N more" overflow
// (AC-100).

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import { presetCardsApi } from '@/services/presetCardsApi';
import type { NichePresetCard } from '@/types/nichePreset';
import HistoryGrid from '../HistoryGrid';

const buildHistoryCard = (
  overrides: Partial<NichePresetCard> = {},
): NichePresetCard => ({
  id: 'preset-1',
  preset_label: 'Vintage Taco Tuesday',
  preset_hash: 'hash-abc',
  slots: {
    spatial_configuration: 'centered',
    visual_description: 'a smiling taco',
    typography_adjectives: 'bold serif',
    font_combination: 'pairing-classic',
    accessories: '',
    style_dna: 'flat vector',
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
  is_in_custom: false,
  custom_promoted_by: null,
  custom_promoted_at: null,
  last_clicked_at: '2026-05-18T10:00:00Z',
  created_at: '2026-05-18T09:00:00Z',
  ...overrides,
});

const mockState: {
  data: NichePresetCard[] | undefined;
  isLoading: boolean;
  isError: boolean;
  promote: ReturnType<typeof vi.fn>;
  promoting: boolean;
} = {
  data: undefined,
  isLoading: false,
  isError: false,
  promote: vi.fn(),
  promoting: false,
};

vi.mock('@/services/presetCardsApi', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/presetCardsApi')>(
      '@/services/presetCardsApi',
    );
  return {
    ...actual,
    useGetHistoryQuery: () => ({
      data: mockState.data,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
    usePromoteCustomMutation: () => [
      mockState.promote,
      { isLoading: mockState.promoting },
    ],
  };
});

const renderGrid = () =>
  renderWithProviders(<HistoryGrid />, {
    reducers: { [presetCardsApi.reducerPath]: presetCardsApi.reducer },
  });

beforeEach(() => {
  mockState.data = undefined;
  mockState.isLoading = false;
  mockState.isError = false;
  mockState.promoting = false;
  mockState.promote = vi.fn().mockReturnValue({
    unwrap: () => Promise.resolve({}),
  });
});

describe('HistoryGrid (PROJ-34 Phase 13t-k)', () => {
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

  it('renders the empty-state Alert when no history exists (AC-99)', () => {
    mockState.data = [];
    renderGrid();
    expect(
      screen.getByText(/confirm a suggestion to fill history/i),
    ).toBeInTheDocument();
  });

  it('renders one card per history entry with the source-type chip', () => {
    mockState.data = [
      buildHistoryCard({ id: 'p-a', preset_label: 'Card A' }),
      buildHistoryCard({
        id: 'p-b',
        preset_label: 'Card B',
        source: {
          card_type: 'mix_edgy',
          references: [{ niche_id: 'n2', product_ids: ['p2'] }],
        },
      }),
    ];
    renderGrid();
    expect(screen.getByText('Card A')).toBeInTheDocument();
    expect(screen.getByText('Card B')).toBeInTheDocument();
    expect(screen.getByText('Top')).toBeInTheDocument();
    expect(screen.getByText('Mix · Edgy')).toBeInTheDocument();
  });

  it('renders "+N more" overflow when card has multiple niche references (AC-100)', () => {
    mockState.data = [
      buildHistoryCard({
        id: 'p-multi',
        preset_label: 'Multi Niche Card',
        source: {
          card_type: 'top',
          references: [
            { niche_id: 'n1', product_ids: ['p1'] },
            { niche_id: 'n2', product_ids: ['p2'] },
            { niche_id: 'n3', product_ids: ['p3'] },
          ],
        },
      }),
    ];
    renderGrid();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('fires promoteCustom mutation and shows success toast on promote click (AC-98)', async () => {
    mockState.data = [buildHistoryCard()];
    renderGrid();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /save to custom/i }),
      );
    });
    expect(mockState.promote).toHaveBeenCalledWith({ presetId: 'preset-1' });
    expect(
      await screen.findByText(/saved to custom/i),
    ).toBeInTheDocument();
  });

  it('shows error toast when promote mutation rejects', async () => {
    mockState.data = [buildHistoryCard()];
    mockState.promote = vi.fn().mockReturnValue({
      unwrap: () => Promise.reject(new Error('boom')),
    });
    renderGrid();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /save to custom/i }),
      );
    });
    expect(await screen.findByText(/save failed/i)).toBeInTheDocument();
  });
});
