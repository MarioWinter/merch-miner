// PROJ-34 Phase 13t-j — TopCardsGrid unit tests.
// Covers: loading skeletons, empty-state Alert (AC-91), error Alert,
// happy-path rendering (EC-34 partial counts).

import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import { presetCardsApi } from '@/services/presetCardsApi';
import type { NichePresetTopCardDict } from '@/types/nichePreset';
import TopCardsGrid from '../TopCardsGrid';

const buildCard = (
  label: string,
  overrides: Partial<NichePresetTopCardDict> = {},
): NichePresetTopCardDict => ({
  slot_spatial_configuration: 'centered',
  slot_visual_description: 'desc',
  slot_typography_adjectives: 'adj',
  slot_font_combination: 'pair',
  slot_accessories: '',
  slot_style_dna: 'dna',
  slot_extra_context: '',
  spatial_is_raw: false,
  visual_is_raw: false,
  typography_is_raw: false,
  font_combination_is_raw: false,
  accessories_is_raw: false,
  style_dna_is_raw: false,
  extra_context_is_raw: false,
  reference_thumbnail_url: `https://example.test/${label}.webp`,
  preset_label: label,
  source_card_type: 'top',
  source_card_references: [{ niche_id: 'n1', product_ids: ['p1'] }],
  ...overrides,
});

// vi.mock must be at top-level. Toggle return value via shared mutable state.
const mockState: {
  data: { top: NichePresetTopCardDict[]; best_of_mix: unknown; top3_product_ids: string[] } | undefined;
  isLoading: boolean;
  isError: boolean;
} = { data: undefined, isLoading: false, isError: false };

vi.mock('@/services/presetCardsApi', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/presetCardsApi')>(
      '@/services/presetCardsApi',
    );
  return {
    ...actual,
    useGetVorschlaegeQuery: () => ({
      data: mockState.data,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
  };
});

const renderGrid = (nicheId: string | null = 'niche-1') =>
  renderWithProviders(<TopCardsGrid nicheId={nicheId} />, {
    reducers: { [presetCardsApi.reducerPath]: presetCardsApi.reducer },
  });

describe('TopCardsGrid (PROJ-34 Phase 13t-j)', () => {
  it('renders nothing when no niche is selected', () => {
    mockState.data = undefined;
    mockState.isLoading = false;
    mockState.isError = false;
    const { container } = renderGrid(null);
    expect(container.firstChild).toBeNull();
  });

  it('renders skeleton tiles while loading', () => {
    mockState.data = undefined;
    mockState.isLoading = true;
    mockState.isError = false;
    const { container } = renderGrid();
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBe(10);
  });

  it('renders the empty-state Alert when result has no top cards', () => {
    mockState.data = {
      top: [],
      best_of_mix: { most_common: null, edgy: null, safe: null },
      top3_product_ids: [],
    };
    mockState.isLoading = false;
    mockState.isError = false;
    renderGrid();
    expect(
      screen.getByText(/no analyzed products yet/i),
    ).toBeInTheDocument();
  });

  it('renders the error Alert on query failure', () => {
    mockState.data = undefined;
    mockState.isLoading = false;
    mockState.isError = true;
    renderGrid();
    expect(
      screen.getByText(/could not load suggestions/i),
    ).toBeInTheDocument();
  });

  it('renders one card per top entry (EC-34: 3 of 10)', () => {
    mockState.data = {
      top: [buildCard('A'), buildCard('B'), buildCard('C')],
      best_of_mix: { most_common: null, edgy: null, safe: null },
      top3_product_ids: [],
    };
    mockState.isLoading = false;
    mockState.isError = false;
    renderGrid();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });
});
