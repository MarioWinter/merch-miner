// PROJ-34 Phase 13t-l — NichePresetConfirmDialog unit tests.
// Covers AC-107..AC-112:
//   - renders 7 slot rows + thumbnail when open
//   - Cancel closes without firing mutation
//   - Bestätigen with persisted card → preset_id path
//   - Bestätigen with Top-Card dict → preset_dict path
//   - Bestätigen success: dispatches onConfirmed + closes + toast
//   - Raw chip renders when is_raw=true (AC-107 last bullet)
//   - Long raw text truncates with tooltip carrying full value (AC-107 / 13t-l.5)

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import { presetCardsApi } from '@/services/presetCardsApi';
import type {
  NichePresetCard,
  NichePresetTopCardDict,
} from '@/types/nichePreset';
import NichePresetConfirmDialog from '../NichePresetConfirmDialog';

const buildPersistedCard = (
  overrides: Partial<NichePresetCard> = {},
): NichePresetCard => ({
  id: 'preset-1',
  preset_label: 'Vintage Taco Tuesday',
  preset_hash: 'hash-abc',
  slots: {
    spatial_configuration: 'vertical_stack',
    visual_description: 'a smiling taco',
    typography_adjectives: 'distressed_vintage_slab',
    font_combination: 'serif_plus_sans_hierarchy',
    accessories: '',
    style_dna: 'vintage_retro',
    extra_context: '',
  },
  raw_flags: {
    spatial_configuration: false,
    visual_description: true,
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

const buildTopCardDict = (
  overrides: Partial<NichePresetTopCardDict> = {},
): NichePresetTopCardDict => ({
  slot_spatial_configuration: 'badge_emblem',
  slot_visual_description: 'a roaring bear',
  slot_typography_adjectives: 'tattoo_old_school_bold',
  slot_font_combination: 'script_plus_block_hierarchy',
  slot_accessories: '',
  slot_style_dna: 'cartoon',
  slot_extra_context: '',
  spatial_is_raw: false,
  visual_is_raw: false,
  typography_is_raw: false,
  font_combination_is_raw: false,
  accessories_is_raw: false,
  style_dna_is_raw: false,
  extra_context_is_raw: false,
  reference_thumbnail_url: 'https://example.test/top.webp',
  preset_label: 'Mountain Bear',
  source_card_type: 'top',
  source_card_references: [{ niche_id: 'n1', product_ids: ['p1', 'p2'] }],
  ...overrides,
});

const mockState: {
  confirm: ReturnType<typeof vi.fn>;
  confirming: boolean;
} = { confirm: vi.fn(), confirming: false };

vi.mock('@/services/presetCardsApi', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/presetCardsApi')>(
      '@/services/presetCardsApi',
    );
  return {
    ...actual,
    useConfirmPresetMutation: () => [
      mockState.confirm,
      { isLoading: mockState.confirming },
    ],
  };
});

const renderDialog = (props: {
  open?: boolean;
  card: Parameters<
    typeof NichePresetConfirmDialog
  >[0]['card'];
  onClose?: () => void;
  onConfirmed?: ReturnType<typeof vi.fn>;
}) => {
  const onClose = props.onClose ?? vi.fn();
  const onConfirmed = props.onConfirmed ?? vi.fn();
  const utils = renderWithProviders(
    <NichePresetConfirmDialog
      open={props.open ?? true}
      card={props.card}
      onClose={onClose}
      onConfirmed={onConfirmed}
    />,
    { reducers: { [presetCardsApi.reducerPath]: presetCardsApi.reducer } },
  );
  return { ...utils, onClose, onConfirmed };
};

beforeEach(() => {
  mockState.confirming = false;
  mockState.confirm = vi.fn().mockReturnValue({
    unwrap: () => Promise.resolve({}),
  });
});

describe('NichePresetConfirmDialog (PROJ-34 Phase 13t-l)', () => {
  it('renders nothing when card is null', () => {
    const { container } = renderDialog({ card: null });
    expect(container.firstChild).toBeNull();
  });

  it('renders 7 slot rows + thumbnail when open with persisted card (AC-107)', () => {
    renderDialog({ card: buildPersistedCard() });
    expect(screen.getByText(/Apply preset/i)).toBeInTheDocument();
    expect(screen.getByAltText('Vintage Taco Tuesday')).toBeInTheDocument();
    expect(screen.getByTestId('slot-row-spatial_configuration')).toBeInTheDocument();
    expect(screen.getByTestId('slot-row-visual_description')).toBeInTheDocument();
    expect(screen.getByTestId('slot-row-typography_adjectives')).toBeInTheDocument();
    expect(screen.getByTestId('slot-row-font_combination')).toBeInTheDocument();
    expect(screen.getByTestId('slot-row-accessories')).toBeInTheDocument();
    expect(screen.getByTestId('slot-row-style_dna')).toBeInTheDocument();
    expect(screen.getByTestId('slot-row-extra_context')).toBeInTheDocument();
  });

  it('resolves built-in IDs to ui_label for display (13t-l.5)', () => {
    renderDialog({ card: buildPersistedCard() });
    // spatial_configuration: vertical_stack → "Vertical Stack"
    expect(screen.getByText('Vertical Stack')).toBeInTheDocument();
    // style_dna: vintage_retro → "Vintage Retro"
    expect(screen.getByText('Vintage Retro')).toBeInTheDocument();
  });

  it('renders Raw chip when is_raw=true on a slot (AC-107)', () => {
    renderDialog({ card: buildPersistedCard() });
    // visual_description has is_raw=true → "Raw" chip appears
    expect(screen.getByText('Raw')).toBeInTheDocument();
  });

  it('Cancel closes without firing the mutation (AC-110)', () => {
    const onClose = vi.fn();
    const onConfirmed = vi.fn();
    renderDialog({ card: buildPersistedCard(), onClose, onConfirmed });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockState.confirm).not.toHaveBeenCalled();
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it('Bestätigen with persisted card uses preset_id path + emits resolved slots (AC-109)', async () => {
    const onClose = vi.fn();
    const onConfirmed = vi.fn();
    renderDialog({ card: buildPersistedCard(), onClose, onConfirmed });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    });
    expect(mockState.confirm).toHaveBeenCalledWith({ preset_id: 'preset-1' });
    expect(onConfirmed).toHaveBeenCalledWith({
      spatial_configuration: 'vertical_stack',
      visual_description: 'a smiling taco',
      typography_adjectives: 'distressed_vintage_slab',
      font_combination: 'serif_plus_sans_hierarchy',
      accessories: '',
      style_dna: 'vintage_retro',
      extra_context: '',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/preset applied/i)).toBeInTheDocument();
  });

  it('Bestätigen with Top-Card dict uses preset_dict path (AC-112 anchor)', async () => {
    const onClose = vi.fn();
    const onConfirmed = vi.fn();
    const topCard = buildTopCardDict();
    renderDialog({ card: topCard, onClose, onConfirmed });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    });
    expect(mockState.confirm).toHaveBeenCalledWith({
      preset_dict: topCard,
      source_card_type: 'top',
      source_refs: topCard.source_card_references,
    });
    expect(onConfirmed).toHaveBeenCalledWith({
      spatial_configuration: 'badge_emblem',
      visual_description: 'a roaring bear',
      typography_adjectives: 'tattoo_old_school_bold',
      font_combination: 'script_plus_block_hierarchy',
      accessories: '',
      style_dna: 'cartoon',
      extra_context: '',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows error toast when confirm mutation rejects (AC-109 negative)', async () => {
    const onClose = vi.fn();
    const onConfirmed = vi.fn();
    mockState.confirm = vi.fn().mockReturnValue({
      unwrap: () => Promise.reject(new Error('boom')),
    });
    renderDialog({ card: buildPersistedCard(), onClose, onConfirmed });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    });
    expect(await screen.findByText(/apply failed/i)).toBeInTheDocument();
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders raw text in full (>200 chars, no truncation per 13t-q1)', () => {
    const longText = 'a'.repeat(250);
    renderDialog({
      card: buildPersistedCard({
        slots: {
          spatial_configuration: longText,
          visual_description: '',
          typography_adjectives: '',
          font_combination: '',
          accessories: '',
          style_dna: '',
          extra_context: '',
        },
        raw_flags: {
          spatial_configuration: true,
          visual_description: false,
          typography_adjectives: false,
          font_combination: false,
          accessories: false,
          style_dna: false,
          extra_context: false,
        },
      }),
    });
    const row = screen.getByTestId('slot-row-spatial_configuration');
    expect(row.textContent ?? '').not.toContain('…');
    expect(row.textContent ?? '').toContain(longText);
  });
});
