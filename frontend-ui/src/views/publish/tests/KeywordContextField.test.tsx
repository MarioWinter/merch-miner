import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import KeywordContextField from '../partials/editor/KeywordContextField';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getCounter = () => screen.getByTestId('KeywordContextField-counter');

// ---------------------------------------------------------------------------
// Tests — Phase P6
// ---------------------------------------------------------------------------

describe('KeywordContextField — Phase P6', () => {
  it('renders a multiline textarea with the default 500-char limit', () => {
    renderWithProviders(
      <KeywordContextField
        value=""
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    const input = screen.getByRole('textbox', { name: /keyword context/i });
    expect(input).toHaveAttribute('maxLength', '500');
    // MUI multiline renders a textarea when rows > 0.
    expect(input.tagName.toLowerCase()).toBe('textarea');
    expect(getCounter()).toHaveTextContent('0/500');
  });

  it('updates the counter and calls onChange on every keystroke', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <KeywordContextField
        value=""
        onChange={onChange}
        onBlur={vi.fn()}
      />,
    );
    const input = screen.getByRole('textbox', { name: /keyword context/i });
    await userEvent.type(input, 'cat');
    expect(onChange).toHaveBeenLastCalledWith('cat');
    expect(getCounter()).toHaveTextContent('3/500');
  });

  it('calls onBlur with the buffered value (blur-if-dirty lives in the hook)', () => {
    const onBlur = vi.fn();
    renderWithProviders(
      <KeywordContextField
        value="brand voice: playful"
        onChange={vi.fn()}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByRole('textbox', { name: /keyword context/i });
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledWith('brand voice: playful');
  });

  it('blur after edit → onBlur fires with the edited value', async () => {
    const onBlur = vi.fn();
    renderWithProviders(
      <KeywordContextField
        value=""
        onChange={vi.fn()}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByRole('textbox', { name: /keyword context/i });
    await userEvent.type(input, 'avoid-words: cheap');
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenLastCalledWith('avoid-words: cheap');
  });

  it('re-syncs the buffer when the server value prop changes', () => {
    const { rerender } = renderWithProviders(
      <KeywordContextField
        value="first"
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    const input = screen.getByRole('textbox', {
      name: /keyword context/i,
    }) as HTMLTextAreaElement;
    expect(input.value).toBe('first');
    rerender(
      <KeywordContextField
        value="second"
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    expect(input.value).toBe('second');
  });

  it('counter tints amber at >= 90% and red at >= 100% of the limit', () => {
    // Normal (10 chars of 500)
    const { unmount: unmountN } = renderWithProviders(
      <KeywordContextField
        value={'A'.repeat(10)}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    const normalColor = getComputedStyle(getCounter()).color;
    unmountN();

    // Amber (450 == floor(500*0.9))
    const { unmount: unmountA } = renderWithProviders(
      <KeywordContextField
        value={'A'.repeat(450)}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    const amberColor = getComputedStyle(getCounter()).color;
    expect(amberColor).not.toBe(normalColor);
    unmountA();

    // Red (>= max) — browsers honour maxLength on typing, so we seed via
    // the value prop (test-only; backend validator is authoritative).
    renderWithProviders(
      <KeywordContextField
        value={'A'.repeat(500)}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    const redColor = getComputedStyle(getCounter()).color;
    expect(redColor).not.toBe(normalColor);
    expect(redColor).not.toBe(amberColor);
  });

  it('honours an override `maxChars` prop', () => {
    renderWithProviders(
      <KeywordContextField
        value="abcd"
        onChange={vi.fn()}
        onBlur={vi.fn()}
        maxChars={10}
      />,
    );
    const input = screen.getByRole('textbox', { name: /keyword context/i });
    expect(input).toHaveAttribute('maxLength', '10');
    expect(getCounter()).toHaveTextContent('4/10');
  });
});
