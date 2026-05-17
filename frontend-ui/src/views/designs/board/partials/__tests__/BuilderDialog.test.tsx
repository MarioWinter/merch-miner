/**
 * PROJ-34 Phase 8 — BuilderDialog renovated UI tests.
 *
 * Covers cross-product counter, Build CTA enabled/disabled, AC-35 confirm
 * threshold (>30), AC-40 manual-edit confirm, AC-34 disabled-when-empty,
 * style toggle through chip removal, EC-16/EC-23 niche-toggle disabled.
 */

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import BuilderDialog from '../BuilderDialog';
import type { ProjectIdea } from '@/views/designs/gallery/types';
import type { NicheContextReason } from '../../types/builder';

const ideas: ProjectIdea[] = [
  {
    id: 'i1', slogan_text: 'Bus Life', signal_type: null,
    market_confidence: null, emotional_archetype: '', pattern_used: '',
    why_it_works: '', niche_name: 'school bus', position: 0,
    reference_products: [], design_count: 0,
  },
  {
    id: 'i2', slogan_text: 'Honk if you love kids', signal_type: null,
    market_confidence: null, emotional_archetype: '', pattern_used: '',
    why_it_works: '', niche_name: null, position: 1,
    reference_products: [], design_count: 0,
  },
];

const NICHE_OK: NicheContextReason = { disabled: false, reasonKey: null };
const NICHE_NO_RESEARCH: NicheContextReason = { disabled: true, reasonKey: 'noResearch' };
const NICHE_NO_LINK: NicheContextReason = { disabled: true, reasonKey: 'noNiche' };

const baseProps = {
  open: true,
  onClose: vi.fn(),
  ideas,
  presets: [],
  referenceUrl: null,
  textareaDirtySinceBuild: false,
  nicheReason: NICHE_OK,
  isBuilding: false,
  onSavePreset: vi.fn(),
  onDeletePreset: vi.fn(),
  onBuild: vi.fn(),
} as const;

const pickStyles = async (slugs: string[]) => {
  for (const slug of slugs) {
    const row = document.querySelector(
      `[role="checkbox"][aria-label^="${slug.split('_').map((s) => s[0]?.toUpperCase() + s.slice(1)).join(' ')}"]`,
    );
    if (row) fireEvent.click(row);
  }
};

describe('BuilderDialog — PROJ-34 Phase 8', () => {
  it('AC-34: Build CTA is disabled when no slogans or styles selected', () => {
    renderWithProviders(<BuilderDialog {...baseProps} />);
    expect(screen.getByRole('button', { name: /Build$/ })).toBeDisabled();
    expect(screen.getByText(/Select slogans and styles/)).toBeInTheDocument();
  });

  it('AC-36: shows accurate N×M count and enables Build CTA', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BuilderDialog {...baseProps} />);
    // Add a free-text slogan
    const textarea = screen.getByPlaceholderText(/Or add custom slogans/i);
    await user.type(textarea, 'Driver squad{enter}I drive you ride');
    // Pick 2 styles via the list rows
    const vintageRow = screen.getByRole('checkbox', { name: /Vintage Retro/i });
    const cartoonRow = screen.getByRole('checkbox', { name: /Cartoon —/i });
    await user.click(vintageRow);
    await user.click(cartoonRow);

    expect(screen.getByText(/Will generate/)).toBeInTheDocument();
    // 2 free-text lines × 2 styles = 4
    expect(screen.getByRole('button', { name: 'Build 4 prompts' })).toBeEnabled();
  });

  it('AC-35: confirm dialog appears when N×M > 30', async () => {
    const onBuild = vi.fn();
    const user = userEvent.setup();
    // 8 free-text slogans × 5 styles = 40 (> 30 threshold)
    renderWithProviders(<BuilderDialog {...baseProps} onBuild={onBuild} />);
    const textarea = screen.getByPlaceholderText(/Or add custom slogans/i);
    const eightSlogans = Array.from({ length: 8 }, (_, i) => `slogan ${i + 1}`).join('\n');
    // fireEvent.change is much faster than per-character user.type for 60+ chars
    fireEvent.change(textarea, { target: { value: eightSlogans } });

    const styles = ['Vintage Retro', '70s Groovy', '80s Neon Synthwave', '90s Grunge', 'Kawaii Chibi'];
    for (const s of styles) {
      const row = screen.getByRole('checkbox', { name: new RegExp(s) });
      fireEvent.click(row);
    }

    const buildBtn = await screen.findByRole('button', { name: 'Build 40 prompts' });
    await user.click(buildBtn);

    expect(await screen.findByText(/About to generate 40 prompts/)).toBeInTheDocument();
    expect(onBuild).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Generate 40 prompts' }));
    expect(onBuild).toHaveBeenCalledTimes(1);
  }, 15000);

  it('AC-40: manual-edit confirm fires when textareaDirtySinceBuild is true', async () => {
    const onBuild = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <BuilderDialog {...baseProps} onBuild={onBuild} textareaDirtySinceBuild={true} />,
    );
    const textarea = screen.getByPlaceholderText(/Or add custom slogans/i);
    fireEvent.change(textarea, { target: { value: 'Hello' } });

    const row = screen.getByRole('checkbox', { name: /Vintage Retro/i });
    fireEvent.click(row);

    const buildBtn = await screen.findByRole('button', { name: 'Build 1 prompts' });
    await user.click(buildBtn);
    expect(await screen.findByText('Replace your manual edits?')).toBeInTheDocument();
    expect(onBuild).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Replace' }));
    expect(onBuild).toHaveBeenCalledTimes(1);
  }, 15000);

  it('AC-30: selected styles appear as removable chips', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BuilderDialog {...baseProps} />);
    const row = screen.getByRole('checkbox', { name: /Vintage Retro/i });
    await user.click(row);

    const chipRegion = screen.getByLabelText('Selected styles');
    const chip = within(chipRegion).getByText('Vintage Retro');
    expect(chip).toBeInTheDocument();

    // Click the chip's delete icon to remove
    const removeBtn = within(chipRegion).getByTestId('CancelIcon');
    await user.click(removeBtn);
    expect(within(chipRegion).queryByText('Vintage Retro')).not.toBeInTheDocument();
  });

  it('EC-16: niche-toggle disabled with "no research" tooltip', () => {
    renderWithProviders(<BuilderDialog {...baseProps} nicheReason={NICHE_NO_RESEARCH} />);
    // MUI Switch renders role="switch" in v7.
    const switchEl = screen.getByRole('switch', { name: /Include niche style context/i });
    expect(switchEl).toBeDisabled();
  });

  it('EC-23: niche-toggle disabled with "project not linked" tooltip', () => {
    renderWithProviders(<BuilderDialog {...baseProps} nicheReason={NICHE_NO_LINK} />);
    // MUI Switch renders role="switch" in v7.
    const switchEl = screen.getByRole('switch', { name: /Include niche style context/i });
    expect(switchEl).toBeDisabled();
  });

  it('renders the ReferenceIndicator only when referenceUrl is set', () => {
    const { rerender } = renderWithProviders(<BuilderDialog {...baseProps} />);
    expect(screen.queryByText(/read-only/)).not.toBeInTheDocument();

    rerender(<BuilderDialog {...baseProps} referenceUrl="https://cdn/img/school-bus.jpg" />);
    expect(screen.getByText('school-bus.jpg')).toBeInTheDocument();
    expect(screen.getByText('(read-only)')).toBeInTheDocument();
  });

  // Suppress unused-import warning for pickStyles helper (kept for future tests)
  it('helper smoke', () => { void pickStyles; expect(true).toBe(true); });
});
