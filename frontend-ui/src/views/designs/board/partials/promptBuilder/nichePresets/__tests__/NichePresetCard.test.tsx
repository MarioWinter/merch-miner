// PROJ-34 Phase 13t-j — NichePresetCard unit tests.
// Covers: thumbnail + label rendering, onClick payload, slot props, selected
// border marker, disabled state blocks clicks.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Chip, IconButton } from '@mui/material';
import { renderWithProviders } from '@/utils/test-utils';
import type { NichePresetTopCardDict } from '@/types/nichePreset';
import NichePresetCard from '../NichePresetCard';

const buildCard = (
  overrides: Partial<NichePresetTopCardDict> = {},
): NichePresetTopCardDict => ({
  slot_spatial_configuration: 'centered',
  slot_visual_description: 'a smiling taco',
  slot_typography_adjectives: 'bold serif',
  slot_font_combination: 'pairing-classic',
  slot_accessories: '',
  slot_style_dna: 'flat vector',
  slot_extra_context: '',
  spatial_is_raw: false,
  visual_is_raw: false,
  typography_is_raw: false,
  font_combination_is_raw: false,
  accessories_is_raw: false,
  style_dna_is_raw: false,
  extra_context_is_raw: false,
  reference_thumbnail_url: 'https://example.test/thumb.webp',
  preset_label: 'Vintage Taco Tuesday',
  source_card_type: 'top',
  source_card_references: [{ niche_id: 'n1', product_ids: ['p1'] }],
  ...overrides,
});

describe('NichePresetCard (PROJ-34 Phase 13t-j)', () => {
  it('renders the thumbnail and label', () => {
    const card = buildCard();
    renderWithProviders(
      <NichePresetCard card={card} onClick={() => undefined} />,
    );
    expect(screen.getByText('Vintage Taco Tuesday')).toBeInTheDocument();
    const img = screen.getByAltText('Vintage Taco Tuesday') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe('https://example.test/thumb.webp');
  });

  it('fires onClick with the card object', () => {
    const card = buildCard();
    const handleClick = vi.fn();
    renderWithProviders(
      <NichePresetCard card={card} onClick={handleClick} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Vintage Taco Tuesday' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(card);
  });

  it('renders topRightChip and bottomActions slots', () => {
    const card = buildCard();
    renderWithProviders(
      <NichePresetCard
        card={card}
        onClick={() => undefined}
        topRightChip={<Chip data-testid="src-chip" label="Top" size="small" />}
        bottomActions={
          <IconButton data-testid="action-btn" aria-label="bookmark">
            x
          </IconButton>
        }
      />,
    );
    expect(screen.getByTestId('src-chip')).toBeInTheDocument();
    expect(screen.getByTestId('action-btn')).toBeInTheDocument();
  });

  it('does not invoke onClick when disabled', () => {
    const card = buildCard();
    const handleClick = vi.fn();
    renderWithProviders(
      <NichePresetCard card={card} onClick={handleClick} disabled />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Vintage Taco Tuesday' }),
    );
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('exposes data-selected="true" when selected (visual border)', () => {
    const card = buildCard();
    const { container } = renderWithProviders(
      <NichePresetCard card={card} onClick={() => undefined} selected />,
    );
    const cardRoot = container.querySelector(
      '.MuiCard-root[data-selected="true"]',
    );
    expect(cardRoot).toBeTruthy();
  });

  it('exposes data-selected="false" by default', () => {
    const card = buildCard();
    const { container } = renderWithProviders(
      <NichePresetCard card={card} onClick={() => undefined} />,
    );
    const cardRoot = container.querySelector(
      '.MuiCard-root[data-selected="false"]',
    );
    expect(cardRoot).toBeTruthy();
  });
});
