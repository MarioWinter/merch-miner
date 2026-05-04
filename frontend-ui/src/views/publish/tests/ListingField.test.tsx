import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import { MBA_LISTING_CHAR_LIMITS } from '../schemas/mbaListingSchema';
import ListingField from '../partials/edit/ListingField';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getCounter = (max: number) =>
  screen.getByText(new RegExp(`^\\d+/${max}$`));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ListingField — Phase P5', () => {
  const TITLE_MAX = MBA_LISTING_CHAR_LIMITS.title; // 60

  it('renders char counter as `current/max` based on the initial value', () => {
    renderWithProviders(
      <ListingField
        value="Hello"
        onChange={vi.fn()}
        onBlur={vi.fn()}
        maxChars={TITLE_MAX}
        label="Title"
      />,
    );
    expect(getCounter(TITLE_MAX)).toHaveTextContent(`5/${TITLE_MAX}`);
  });

  it('calls onChange on every keystroke with the buffered value', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <ListingField
        value=""
        onChange={onChange}
        onBlur={vi.fn()}
        maxChars={TITLE_MAX}
        label="Title"
      />,
    );
    const input = screen.getByRole('textbox', { name: /title/i });
    await userEvent.type(input, 'Ab');
    // onChange fires once per keystroke with the cumulative buffer.
    expect(onChange).toHaveBeenNthCalledWith(1, 'A');
    expect(onChange).toHaveBeenNthCalledWith(2, 'Ab');
  });

  it('blur without any change → onBlur called once with the unchanged value', () => {
    // Blur-if-dirty compare lives in the hook (`textSetters.onBlur`).
    // The component always fires its onBlur; the hook decides whether to
    // PATCH. Here we only verify that the component's onBlur contract
    // delivers the current buffer value.
    const onBlur = vi.fn();
    renderWithProviders(
      <ListingField
        value="BrandX"
        onChange={vi.fn()}
        onBlur={onBlur}
        maxChars={TITLE_MAX}
        label="Title"
      />,
    );
    const input = screen.getByRole('textbox', { name: /title/i });
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledWith('BrandX');
  });

  it('blur after edit → onBlur fires with the edited value', async () => {
    const onBlur = vi.fn();
    renderWithProviders(
      <ListingField
        value="Old"
        onChange={vi.fn()}
        onBlur={onBlur}
        maxChars={TITLE_MAX}
        label="Title"
      />,
    );
    const input = screen.getByRole('textbox', { name: /title/i });
    await userEvent.clear(input);
    await userEvent.type(input, 'New');
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenLastCalledWith('New');
  });

  it('re-syncs the buffer when the server-provided value changes', () => {
    const { rerender } = renderWithProviders(
      <ListingField
        value="First"
        onChange={vi.fn()}
        onBlur={vi.fn()}
        maxChars={TITLE_MAX}
        label="Title"
      />,
    );
    const input = screen.getByRole('textbox', { name: /title/i });
    expect((input as HTMLInputElement).value).toBe('First');

    rerender(
      <ListingField
        value="Second"
        onChange={vi.fn()}
        onBlur={vi.fn()}
        maxChars={TITLE_MAX}
        label="Title"
      />,
    );
    expect((input as HTMLInputElement).value).toBe('Second');
  });

  it('tints the counter amber at >=90% and red at >=100% of the limit', () => {
    // Normal (<90%)
    const { unmount: unmountN } = renderWithProviders(
      <ListingField
        value={'A'.repeat(10)}
        onChange={vi.fn()}
        onBlur={vi.fn()}
        maxChars={TITLE_MAX}
        label="Title"
      />,
    );
    const normalColor = getComputedStyle(getCounter(TITLE_MAX)).color;
    unmountN();

    // Amber (54 == floor(60*0.9))
    const { unmount: unmountA } = renderWithProviders(
      <ListingField
        value={'A'.repeat(54)}
        onChange={vi.fn()}
        onBlur={vi.fn()}
        maxChars={TITLE_MAX}
        label="Title"
      />,
    );
    const amberColor = getComputedStyle(getCounter(TITLE_MAX)).color;
    expect(amberColor).not.toBe(normalColor);
    unmountA();

    // Red (>= max)
    renderWithProviders(
      <ListingField
        value={'A'.repeat(TITLE_MAX)}
        onChange={vi.fn()}
        onBlur={vi.fn()}
        maxChars={TITLE_MAX}
        label="Title"
      />,
    );
    const redColor = getComputedStyle(getCounter(TITLE_MAX)).color;
    expect(redColor).not.toBe(normalColor);
    expect(redColor).not.toBe(amberColor);
  });

  it('PROJ-17 Chat hover icon: click forwards the buffered value to onOpenChat', async () => {
    const onOpenChat = vi.fn();
    renderWithProviders(
      <ListingField
        value="Hello"
        onChange={vi.fn()}
        onBlur={vi.fn()}
        maxChars={TITLE_MAX}
        label="Title"
        onOpenChat={onOpenChat}
      />,
    );
    // Multiple labels match (Tooltip title + aria-label) — pick the button.
    const btn = screen.getAllByRole('button', { name: /open chat/i })[0];
    fireEvent.click(btn);
    expect(onOpenChat).toHaveBeenCalledWith('Hello');
  });

  it('Chat hover icon is not rendered when `onOpenChat` is omitted', () => {
    renderWithProviders(
      <ListingField
        value=""
        onChange={vi.fn()}
        onBlur={vi.fn()}
        maxChars={TITLE_MAX}
        label="Title"
      />,
    );
    expect(
      screen.queryByRole('button', { name: /open chat/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the "AI truncated" chip when `truncated` is true', () => {
    renderWithProviders(
      <ListingField
        value="Hello"
        onChange={vi.fn()}
        onBlur={vi.fn()}
        maxChars={TITLE_MAX}
        label="Title"
        truncated
      />,
    );
    const chip = screen.getByTestId('ListingField-truncatedChip');
    expect(chip).toHaveTextContent(/ai truncated/i);
  });

  it('does not render the truncated chip when `truncated` is false/omitted', () => {
    renderWithProviders(
      <ListingField
        value="Hello"
        onChange={vi.fn()}
        onBlur={vi.fn()}
        maxChars={TITLE_MAX}
        label="Title"
      />,
    );
    expect(
      screen.queryByTestId('ListingField-truncatedChip'),
    ).not.toBeInTheDocument();
  });
});
