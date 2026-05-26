// PROJ-34 Phase 13t-j — BestOfMixRow unit tests.
// Covers: 3 Mix cards render, skeletons when missing, regen button fires
// mutation, 429 surfaces rate-limit snackbar, polling triggers refetch.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import { presetCardsApi } from '@/services/presetCardsApi';
import type {
  NichePresetTopCardDict,
  VorschlaegeResponse,
} from '@/types/nichePreset';
import BestOfMixRow from '../BestOfMixRow';

const buildCard = (
  label: string,
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
  source_card_type: 'mix_most_common',
  source_card_references: [{ niche_id: 'n1', product_ids: ['p1'] }],
});

const mockState: {
  data: VorschlaegeResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: ReturnType<typeof vi.fn>;
  regenerate: ReturnType<typeof vi.fn>;
  regenLoading: boolean;
} = {
  data: undefined,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  regenerate: vi.fn(),
  regenLoading: false,
};

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
      refetch: mockState.refetch,
    }),
    useRegenerateMixMutation: () => [
      mockState.regenerate,
      { isLoading: mockState.regenLoading },
    ],
  };
});

const renderRow = (nicheId: string | null = 'niche-1') =>
  renderWithProviders(<BestOfMixRow nicheId={nicheId} />, {
    reducers: { [presetCardsApi.reducerPath]: presetCardsApi.reducer },
  });

beforeEach(() => {
  mockState.data = undefined;
  mockState.isLoading = false;
  mockState.isError = false;
  mockState.regenLoading = false;
  mockState.refetch = vi.fn();
  mockState.regenerate = vi.fn().mockReturnValue({ unwrap: () => Promise.resolve({}) });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BestOfMixRow (PROJ-34 Phase 13t-j)', () => {
  it('renders nothing when no niche is selected', () => {
    const { container } = renderRow(null);
    expect(container.firstChild).toBeNull();
  });

  it('renders the section header and refresh button', () => {
    mockState.data = {
      top: [],
      best_of_mix: {
        most_common: buildCard('Most-Common Mix'),
        edgy: buildCard('Edgy Mix'),
        safe: buildCard('Safe Mix'),
      },
      top3_product_ids: [],
    };
    renderRow();
    expect(screen.getByText(/Best-of-Mix/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recalculate/i })).toBeInTheDocument();
  });

  it('renders 3 Mix cards when all three variants are present', () => {
    mockState.data = {
      top: [],
      best_of_mix: {
        most_common: buildCard('Card MC'),
        edgy: buildCard('Card E'),
        safe: buildCard('Card S'),
      },
      top3_product_ids: [],
    };
    renderRow();
    // Labels get replaced with i18n strings — assert the i18n labels.
    expect(screen.getByText('Most-Common Mix')).toBeInTheDocument();
    expect(screen.getByText('Edgy Mix')).toBeInTheDocument();
    expect(screen.getByText('Safe Mix')).toBeInTheDocument();
  });

  it('renders skeletons for missing mix variants', () => {
    mockState.data = {
      top: [],
      best_of_mix: { most_common: null, edgy: null, safe: null },
      top3_product_ids: [],
    };
    renderRow();
    expect(screen.getByTestId('mix-skeleton-most_common')).toBeInTheDocument();
    expect(screen.getByTestId('mix-skeleton-edgy')).toBeInTheDocument();
    expect(screen.getByTestId('mix-skeleton-safe')).toBeInTheDocument();
  });

  it('fires regenerateMix mutation when refresh is clicked', async () => {
    mockState.data = {
      top: [],
      best_of_mix: {
        most_common: buildCard('A'),
        edgy: buildCard('B'),
        safe: buildCard('C'),
      },
      top3_product_ids: [],
    };
    renderRow();
    const btn = screen.getByRole('button', { name: /Recalculate/i });
    fireEvent.click(btn);
    expect(mockState.regenerate).toHaveBeenCalledWith({ niche_id: 'niche-1' });
  });

  it('surfaces a rate-limit snackbar on 429', async () => {
    mockState.data = {
      top: [],
      best_of_mix: {
        most_common: buildCard('A'),
        edgy: buildCard('B'),
        safe: buildCard('C'),
      },
      top3_product_ids: [],
    };
    mockState.regenerate = vi.fn().mockReturnValue({
      unwrap: () => Promise.reject({ status: 429 }),
    });
    renderRow();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Recalculate/i }));
    });
    expect(
      await screen.findByText(/too many regenerations/i),
    ).toBeInTheDocument();
  });

  it('polls refetch when at least one mix variant is missing', () => {
    vi.useFakeTimers();
    mockState.data = {
      top: [],
      best_of_mix: { most_common: null, edgy: null, safe: null },
      top3_product_ids: [],
    };
    renderRow();
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(mockState.refetch).toHaveBeenCalled();
  });
});
