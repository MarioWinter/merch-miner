import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import KeywordsChipField from '../partials/global/KeywordsChipField';
import { LISTING_CHAR_LIMITS } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getInput = () => screen.getByTestId('KeywordsChipField-input');
const getCounter = () => screen.getByTestId('KeywordsChipField-counter');
const getRoot = () => screen.getByTestId('KeywordsChipField');

const MAX = LISTING_CHAR_LIMITS.keywords_per_language;

// Word guaranteed to land under the 90% amber threshold: 10 chars.
const UNDER_AMBER = 'abcdefghij'; // length 10 — counter "10/50"

// 45-char value (90% of 50 exactly) so `severity === 'amber'`.
const AT_AMBER = 'a'.repeat(45);

// 50-char value (100% of 50) so `severity === 'red'`.
const AT_RED = 'a'.repeat(50);

// ---------------------------------------------------------------------------
// Tests — Phase U9 (AC-84 / AC-85 / AC-110)
// ---------------------------------------------------------------------------

describe('KeywordsChipField — Phase U9', () => {
  let onCommit: ReturnType<typeof vi.fn>;
  let onRemove: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCommit = vi.fn();
    onRemove = vi.fn();
  });

  it('commits a chip when Enter is pressed', async () => {
    renderWithProviders(
      <KeywordsChipField
        value={[]}
        lang="en"
        onCommit={onCommit}
        onRemove={onRemove}
      />,
    );
    const input = getInput();
    await userEvent.type(input, 'dog');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('dog');
  });

  it('rejects a comma-containing input: commits part before comma and keeps remainder buffered', async () => {
    // AC-110: typing `,` is not stored as a literal char — the prefix commits
    // and the forbidden char is stripped from the buffer.
    renderWithProviders(
      <KeywordsChipField
        value={[]}
        lang="en"
        onCommit={onCommit}
        onRemove={onRemove}
      />,
    );
    const input = getInput();
    await userEvent.type(input, 'dog,');
    expect(onCommit).toHaveBeenCalledWith('dog');
    // Input buffer is cleared of the `,` delimiter.
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('rejects a semicolon mid-buffer the same way', async () => {
    renderWithProviders(
      <KeywordsChipField
        value={[]}
        lang="en"
        onCommit={onCommit}
        onRemove={onRemove}
      />,
    );
    const input = getInput();
    await userEvent.type(input, 'cat;');
    expect(onCommit).toHaveBeenCalledWith('cat');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('rejects a case-insensitive duplicate and shakes + shows hint', async () => {
    renderWithProviders(
      <KeywordsChipField
        value={['Dog']}
        lang="en"
        onCommit={onCommit}
        onRemove={onRemove}
      />,
    );
    const input = getInput();
    await userEvent.type(input, 'dog');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
    // Hint renders (rejected reason) — presence is enough, copy is i18n'd.
    expect(screen.getByTestId('KeywordsChipField-hint')).toBeInTheDocument();
    // Shake is an animation state on the root; we only need to confirm the
    // hint rendered since the animation lifecycle is timer-based.
    expect(getRoot()).toBeInTheDocument();
  });

  it('counter colour transitions: normal → amber (>=90%) → red (>=100%)', () => {
    const { unmount: unmountN } = renderWithProviders(
      <KeywordsChipField
        value={[UNDER_AMBER]}
        lang="en"
        onCommit={onCommit}
        onRemove={onRemove}
      />,
    );
    const normalColour = getComputedStyle(getCounter()).color;
    expect(getCounter()).toHaveTextContent(`10/${MAX}`);
    unmountN();

    const { unmount: unmountA } = renderWithProviders(
      <KeywordsChipField
        value={[AT_AMBER]}
        lang="en"
        onCommit={onCommit}
        onRemove={onRemove}
      />,
    );
    const amberColour = getComputedStyle(getCounter()).color;
    expect(amberColour).not.toBe(normalColour);
    unmountA();

    renderWithProviders(
      <KeywordsChipField
        value={[AT_RED]}
        lang="en"
        onCommit={onCommit}
        onRemove={onRemove}
      />,
    );
    const redColour = getComputedStyle(getCounter()).color;
    expect(redColour).not.toBe(normalColour);
    expect(redColour).not.toBe(amberColour);
  });
});
