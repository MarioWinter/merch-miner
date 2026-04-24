import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';

// ---------------------------------------------------------------------------
// Mocks -- `react-colorful` uses canvas-less pointer math that jsdom doesn't
// support, so we swap in a lean test stub that exposes `onChange` via a
// single button click. Keeps the test focused on our wiring (validation +
// commit) rather than the library's internals.
// ---------------------------------------------------------------------------

vi.mock('react-colorful', () => ({
  HexColorPicker: ({
    color,
    onChange,
  }: {
    color: string;
    onChange: (hex: string) => void;
  }) => (
    <button
      type="button"
      data-testid="HexColorPicker-mock"
      data-color={color}
      onClick={() => onChange('#abcdef')}
    >
      mock-picker
    </button>
  ),
}));

import BackgroundColorPicker from '../partials/global/BackgroundColorPicker';

// ---------------------------------------------------------------------------
// Tests -- Phase V3 (AC-125)
// ---------------------------------------------------------------------------

describe('BackgroundColorPicker -- Phase V3', () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  const getInput = () =>
    screen.getByTestId('BackgroundColorPicker-input') as HTMLInputElement;

  it('commits a valid hex on blur (upper-case normalized)', async () => {
    renderWithProviders(
      <BackgroundColorPicker value="" onChange={onChange} />,
    );
    const input = getInput();
    await userEvent.clear(input);
    await userEvent.type(input, '#ff00aa');
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#FF00AA');
  });

  it('commits on Enter key', async () => {
    renderWithProviders(
      <BackgroundColorPicker value="" onChange={onChange} />,
    );
    const input = getInput();
    await userEvent.clear(input);
    await userEvent.type(input, '#123abc{Enter}');

    expect(onChange).toHaveBeenCalledWith('#123ABC');
  });

  it('rejects invalid hex + does not commit + shows error hint', async () => {
    renderWithProviders(
      <BackgroundColorPicker value="" onChange={onChange} />,
    );
    const input = getInput();
    await userEvent.clear(input);
    await userEvent.type(input, 'red');
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => {
      // MUI renders the hint inline; react-i18next defaults expose the text.
      expect(screen.getByText(/6-digit hex color/i)).toBeInTheDocument();
    });
  });

  it('prepends `#` + uppercases when user omits it', async () => {
    renderWithProviders(
      <BackgroundColorPicker value="" onChange={onChange} />,
    );
    const input = getInput();
    await userEvent.clear(input);
    await userEvent.type(input, 'abcdef');
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith('#ABCDEF');
  });

  it('clears the value when the input is emptied (allowed blank)', async () => {
    renderWithProviders(
      <BackgroundColorPicker value="#FF00AA" onChange={onChange} />,
    );
    const input = getInput();
    await userEvent.clear(input);
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('skips the PATCH when the committed value matches the server value', async () => {
    renderWithProviders(
      <BackgroundColorPicker value="#FF00AA" onChange={onChange} />,
    );
    const input = getInput();
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('forwards picker drag values to onChange (canvas path)', () => {
    renderWithProviders(
      <BackgroundColorPicker value="" onChange={onChange} />,
    );
    fireEvent.click(screen.getByTestId('HexColorPicker-mock'));

    expect(onChange).toHaveBeenCalledWith('#ABCDEF');
  });

  it('syncs buffer when `value` prop changes (server reconciliation)', async () => {
    const { rerender } = renderWithProviders(
      <BackgroundColorPicker value="#FF00AA" onChange={onChange} />,
    );
    expect(getInput().value).toBe('#FF00AA');

    rerender(<BackgroundColorPicker value="#00FF00" onChange={onChange} />);
    await waitFor(() => expect(getInput().value).toBe('#00FF00'));
  });
});
