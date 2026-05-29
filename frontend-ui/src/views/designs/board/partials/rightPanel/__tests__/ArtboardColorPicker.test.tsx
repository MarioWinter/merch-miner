import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';

// Mock react-colorful's RgbaStringColorPicker with a controlled stub.
// Renders a button that, when clicked, calls onChange with a fixed rgba string.
vi.mock('react-colorful', () => ({
  RgbaStringColorPicker: ({
    color,
    onChange,
  }: {
    color: string;
    onChange: (next: string) => void;
  }) => (
    <div data-testid="rcf-picker" data-color={color}>
      <button
        type="button"
        data-testid="rcf-trigger"
        onClick={() => onChange('rgba(10, 20, 30, 0.4)')}
      >
        trigger
      </button>
    </div>
  ),
}));

import ArtboardColorPicker from '../ArtboardColorPicker';

const SWATCH = 'ArtboardColorPicker-swatch';
const POPOVER = 'ArtboardColorPicker-popover';
const HEX_INPUT = 'ArtboardColorPicker-hex-input';
const HEX_ERROR = 'ArtboardColorPicker-hex-error';

describe('ArtboardColorPicker', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('renders a swatch button with the checker-pattern background', () => {
    renderWithProviders(
      <ArtboardColorPicker value="#FF5A4F" onChange={() => {}} />,
    );
    const swatch = screen.getByTestId(SWATCH);
    expect(swatch).toBeInTheDocument();
    // The styled SwatchButton applies a conic-gradient as background-image —
    // emotion injects it into a generated class rule. Read it back via
    // getComputedStyle which resolves stylesheet-injected declarations in
    // jsdom for inline CSS-in-JS classes.
    const style = window.getComputedStyle(swatch);
    expect(style.backgroundImage).toContain('conic-gradient');
  });

  it('opens the popover on swatch click', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ArtboardColorPicker value="#FF5A4F" onChange={() => {}} />,
    );
    expect(screen.queryByTestId(POPOVER)).not.toBeInTheDocument();
    await user.click(screen.getByTestId(SWATCH));
    expect(await screen.findByTestId(POPOVER)).toBeInTheDocument();
  });

  it('emits the rgba string from RgbaStringColorPicker onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <ArtboardColorPicker value="#FF5A4F" onChange={onChange} />,
    );
    await user.click(screen.getByTestId(SWATCH));
    await user.click(await screen.findByTestId('rcf-trigger'));
    expect(onChange).toHaveBeenCalledWith('rgba(10, 20, 30, 0.4)');
  });

  it('accepts an 8-char hex input and commits on Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <ArtboardColorPicker value="#FFFFFF" onChange={onChange} />,
    );
    await user.click(screen.getByTestId(SWATCH));
    const input = await screen.findByTestId(HEX_INPUT);
    // The input is pre-filled with the current value (#FFFFFF) on open
    // so the user can read the active hex at a glance. Clear it before
    // typing the new value.
    await user.clear(input);
    await user.type(input, '#FF5A4F80');
    await user.keyboard('{Enter}');
    // 0x80 = 128 → 128/255 ≈ 0.502
    expect(onChange).toHaveBeenCalledWith('rgba(255, 90, 79, 0.502)');
    // Error state should NOT be set on valid input
    expect(screen.queryByTestId(HEX_ERROR)).not.toBeInTheDocument();
  });

  it('rejects an invalid hex and does NOT call onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <ArtboardColorPicker value="#FFFFFF" onChange={onChange} />,
    );
    await user.click(screen.getByTestId(SWATCH));
    const input = await screen.findByTestId(HEX_INPUT);
    await user.type(input, '#XYZ');
    await user.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(await screen.findByTestId(HEX_ERROR)).toBeInTheDocument();
  });
});
