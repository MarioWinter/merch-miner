// PROJ-34 Phase 13t-s — CollectionCardsRow unit tests.
// Covers: empty render-null, N-card rendering, click handler invocation.

import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import type { NichePresetTopCardDict } from '@/types/nichePreset';
import CollectionCardsRow from '../CollectionCardsRow';

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
  source_card_type: 'collection',
  source_card_references: [{ niche_id: 'n1', product_ids: ['p1'] }],
  ...overrides,
});

describe('CollectionCardsRow', () => {
  it('returns null when cards array is empty', () => {
    const { container } = renderWithProviders(<CollectionCardsRow cards={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one card per item', () => {
    renderWithProviders(
      <CollectionCardsRow
        cards={[buildCard('Alpha'), buildCard('Beta'), buildCard('Gamma')]}
      />,
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('invokes onCardClick with the clicked card', async () => {
    const onCardClick = vi.fn();
    const card = buildCard('ClickMe');
    renderWithProviders(
      <CollectionCardsRow cards={[card]} onCardClick={onCardClick} />,
    );
    await userEvent.click(screen.getByText('ClickMe'));
    expect(onCardClick).toHaveBeenCalledTimes(1);
    expect(onCardClick).toHaveBeenCalledWith(card);
  });
});
