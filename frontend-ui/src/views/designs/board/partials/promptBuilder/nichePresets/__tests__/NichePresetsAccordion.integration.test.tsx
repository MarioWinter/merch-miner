// PROJ-34 Phase 13t-l — integration test for the card-click → confirm flow.
// Mounts NichePresetsAccordion with mocked RTK Query hooks. Asserts that
// clicking a History card opens the Confirm dialog and clicking "Confirm"
// fires the persisted-id mutation and invokes the host's `onApplyPreset`
// spy with the 7 resolved slot values (AC-109 + AC-112 wiring boundary).

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import { presetCardsApi } from '@/services/presetCardsApi';
import type { NichePresetCard } from '@/types/nichePreset';
import NichePresetsAccordion from '../NichePresetsAccordion';

const buildHistoryCard = (
  overrides: Partial<NichePresetCard> = {},
): NichePresetCard => ({
  id: 'preset-int-1',
  preset_label: 'Integration Card',
  preset_hash: 'hash-int',
  slots: {
    spatial_configuration: 'vertical_stack',
    visual_description: 'integration visual',
    typography_adjectives: 'distressed_vintage_slab',
    font_combination: 'serif_plus_sans_hierarchy',
    accessories: 'sunburst rays radiating outward from behind the illustration',
    style_dna: 'vintage_retro',
    extra_context: 'extra ctx',
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
  reference_thumbnail_url: 'https://example.test/int.webp',
  is_in_history: true,
  is_in_custom: false,
  custom_promoted_by: null,
  custom_promoted_at: null,
  last_clicked_at: '2026-05-18T10:00:00Z',
  created_at: '2026-05-18T09:00:00Z',
  ...overrides,
});

const mockState: {
  history: NichePresetCard[];
  confirm: ReturnType<typeof vi.fn>;
} = {
  history: [],
  confirm: vi.fn(),
};

vi.mock('@/services/presetCardsApi', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/presetCardsApi')>(
      '@/services/presetCardsApi',
    );
  return {
    ...actual,
    useGetVorschlaegeQuery: () => ({ data: undefined, isLoading: false, error: undefined }),
    useGetHistoryQuery: () => ({
      data: mockState.history,
      isLoading: false,
      error: undefined,
      isError: false,
    }),
    useGetCustomQuery: () => ({ data: [], isLoading: false, error: undefined }),
    useConfirmPresetMutation: () => [mockState.confirm, { isLoading: false }],
    usePromoteCustomMutation: () => [vi.fn(), { isLoading: false }],
  };
});

beforeEach(() => {
  mockState.history = [buildHistoryCard()];
  mockState.confirm = vi.fn().mockReturnValue({
    unwrap: () => Promise.resolve({}),
  });
});

describe('NichePresetsAccordion + ConfirmDialog wiring (PROJ-34 Phase 13t-l)', () => {
  it('clicking a history card opens the Confirm dialog with that card', async () => {
    renderWithProviders(
      <NichePresetsAccordion nicheId="niche-1" onApplyPreset={vi.fn()} />,
      { reducers: { [presetCardsApi.reducerPath]: presetCardsApi.reducer } },
    );

    // Switch to History tab so the History grid mounts.
    fireEvent.click(screen.getByRole('tab', { name: /History/i }));

    // Click the history card.
    fireEvent.click(
      screen.getByRole('button', { name: /Integration Card/i }),
    );

    expect(screen.getByText(/Apply preset/i)).toBeInTheDocument();
    expect(screen.getByText(/Vertical Stack/)).toBeInTheDocument();
  });

  it('Confirm fires mutation and forwards resolved slots to onApplyPreset', async () => {
    const onApplyPreset = vi.fn();
    renderWithProviders(
      <NichePresetsAccordion nicheId="niche-1" onApplyPreset={onApplyPreset} />,
      { reducers: { [presetCardsApi.reducerPath]: presetCardsApi.reducer } },
    );

    fireEvent.click(screen.getByRole('tab', { name: /History/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /Integration Card/i }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    });

    expect(mockState.confirm).toHaveBeenCalledWith({ preset_id: 'preset-int-1' });
    expect(onApplyPreset).toHaveBeenCalledWith({
      spatial_configuration: 'vertical_stack',
      visual_description: 'integration visual',
      typography_adjectives: 'distressed_vintage_slab',
      font_combination: 'serif_plus_sans_hierarchy',
      accessories: 'sunburst rays radiating outward from behind the illustration',
      style_dna: 'vintage_retro',
      extra_context: 'extra ctx',
    });
  });

  it('Cancel closes the dialog without invoking onApplyPreset', () => {
    const onApplyPreset = vi.fn();
    renderWithProviders(
      <NichePresetsAccordion nicheId="niche-1" onApplyPreset={onApplyPreset} />,
      { reducers: { [presetCardsApi.reducerPath]: presetCardsApi.reducer } },
    );

    fireEvent.click(screen.getByRole('tab', { name: /History/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /Integration Card/i }),
    );

    expect(screen.getByText(/Apply preset/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockState.confirm).not.toHaveBeenCalled();
    expect(onApplyPreset).not.toHaveBeenCalled();
  });
});
