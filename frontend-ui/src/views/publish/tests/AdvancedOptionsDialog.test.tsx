import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import AdvancedOptionsDialog from '../partials/global/AdvancedOptionsDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getBrand = () => screen.getByTestId('AdvancedOptions-brand');
const getCategory = () => screen.getByTestId('AdvancedOptions-category');
const getSave = () => screen.getByTestId('AdvancedOptions-save');

// ---------------------------------------------------------------------------
// Tests — Phase U9 (AC-130 / AC-131 / AC-132)
// ---------------------------------------------------------------------------

describe('AdvancedOptionsDialog — Phase U9', () => {
  let onSave: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSave = vi.fn();
    onClose = vi.fn();
  });

  it('Save fires a single batched onSave with trimmed brand + category', async () => {
    renderWithProviders(
      <AdvancedOptionsDialog
        open
        defaultBrand=""
        defaultCategory=""
        onClose={onClose}
        onSave={onSave}
      />,
    );

    // User edits both fields before Save — one PATCH lands, not two.
    await userEvent.type(getBrand(), '  AcmeCo ');
    await userEvent.type(getCategory(), '  Apparel  ');

    fireEvent.click(getSave());

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('AcmeCo', 'Apparel');
  });

  it('Cancel fires onClose without onSave (discards edits)', async () => {
    renderWithProviders(
      <AdvancedOptionsDialog
        open
        defaultBrand="OldBrand"
        defaultCategory="OldCategory"
        onClose={onClose}
        onSave={onSave}
      />,
    );

    await userEvent.clear(getBrand());
    await userEvent.type(getBrand(), 'NewBrand');

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('renders with default values pre-filled (mount-on-open seed)', () => {
    renderWithProviders(
      <AdvancedOptionsDialog
        open
        defaultBrand="SeedBrand"
        defaultCategory="SeedCategory"
        onClose={onClose}
        onSave={onSave}
      />,
    );
    expect((getBrand() as HTMLInputElement).value).toBe('SeedBrand');
    expect((getCategory() as HTMLInputElement).value).toBe('SeedCategory');
  });

  it('returns null when closed (mount-on-open)', () => {
    renderWithProviders(
      <AdvancedOptionsDialog
        open={false}
        defaultBrand=""
        defaultCategory=""
        onClose={onClose}
        onSave={onSave}
      />,
    );
    expect(screen.queryByTestId('AdvancedOptions-brand')).not.toBeInTheDocument();
  });
});
