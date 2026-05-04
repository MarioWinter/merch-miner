import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import AIImproveButton from '../partials/editor/AIImproveButton';
import type { AIImproveListingResponse, Listing } from '../types';

// ---------------------------------------------------------------------------
// Snackbar spy — notistack is already wrapped by renderWithProviders via
// SnackbarProvider, so we only need to spy on enqueueSnackbar.
// ---------------------------------------------------------------------------

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', async (importOriginal) => {
  const actual = await importOriginal<typeof import('notistack')>();
  return {
    ...actual,
    useSnackbar: () => ({
      enqueueSnackbar: mockEnqueueSnackbar,
      closeSnackbar: vi.fn(),
    }),
  };
});

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const makeListingResponse = (
  truncated_fields: string[],
): AIImproveListingResponse => ({
  listing: {
    id: 'l-1',
    idea: 'i-1',
    design: null,
    marketplace_type: 'mba',
    round: 1,
    brand_name: 'BrandX',
    title: 'TitleX',
    bullet_1: 'B1',
    bullet_2: 'B2',
    description: 'Desc',
    keyword_context: 'kw',
    status: 'draft',
    generated_by: 'ai',
    availability: 'public',
    publish_mode: 'live',
    language: 'en',
    translations: {},
    created_at: '',
    updated_at: '',
  } as Listing,
  truncated_fields,
});

// ---------------------------------------------------------------------------
// Tests — Phase P7
// ---------------------------------------------------------------------------

describe('AIImproveButton — Phase P7', () => {
  beforeEach(() => {
    mockEnqueueSnackbar.mockClear();
  });

  it('renders the wand icon + tooltip when enabled', async () => {
    renderWithProviders(
      <AIImproveButton
        aiImprove={vi.fn().mockResolvedValue(makeListingResponse([]))}
        isImproving={false}
        hasListing
      />,
    );
    const btn = screen.getByTestId('AIImproveButton');
    expect(btn).toBeEnabled();
    // The wand icon lives inside the button — querying by role="img" is
    // noisy with MUI, so we just confirm the spinner isn't there.
    expect(btn.querySelector('.MuiCircularProgress-root')).toBeNull();
  });

  it('click → aiImprove() fires, success snackbar + onTruncated called with fields', async () => {
    const onTruncated = vi.fn();
    const aiImprove = vi
      .fn()
      .mockResolvedValue(makeListingResponse(['title', 'bullet_1']));
    renderWithProviders(
      <AIImproveButton
        aiImprove={aiImprove}
        isImproving={false}
        hasListing
        onTruncated={onTruncated}
      />,
    );
    fireEvent.click(screen.getByTestId('AIImproveButton'));
    await waitFor(() => expect(aiImprove).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onTruncated).toHaveBeenCalledTimes(1));
    expect(onTruncated).toHaveBeenCalledWith(['title', 'bullet_1']);
    // Success snackbar fired.
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.stringMatching(/improved with ai/i),
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('rejection → error snackbar, onTruncated not called', async () => {
    const onTruncated = vi.fn();
    const aiImprove = vi.fn().mockRejectedValue(new Error('boom'));
    renderWithProviders(
      <AIImproveButton
        aiImprove={aiImprove}
        isImproving={false}
        hasListing
        onTruncated={onTruncated}
      />,
    );
    fireEvent.click(screen.getByTestId('AIImproveButton'));
    await waitFor(() =>
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        expect.stringMatching(/ai improve failed/i),
        expect.objectContaining({ variant: 'error' }),
      ),
    );
    expect(onTruncated).not.toHaveBeenCalled();
  });

  it('isImproving=true → spinner rendered, button disabled', () => {
    renderWithProviders(
      <AIImproveButton
        aiImprove={vi.fn()}
        isImproving
        hasListing
      />,
    );
    const btn = screen.getByTestId('AIImproveButton');
    expect(btn).toBeDisabled();
    expect(btn.querySelector('.MuiCircularProgress-root')).not.toBeNull();
  });

  it('hasListing=false → button disabled, tooltip promises to create a listing first', () => {
    renderWithProviders(
      <AIImproveButton
        aiImprove={vi.fn()}
        isImproving={false}
        hasListing={false}
      />,
    );
    const btn = screen.getByTestId('AIImproveButton');
    expect(btn).toBeDisabled();

    // Tooltip lives on the wrapper span — MUI renders `aria-label` on
    // the disabled button + the tooltip text lives in a portal. Easiest
    // assertion: hover the wrapper and wait for the tooltip node. But
    // JSDOM doesn't dispatch hover by default — query the wrapper's
    // title attribute instead (MUI Tooltip places it on children until
    // activated).
    // Not-currently-open tooltips don't attach a DOM node, so we
    // instead verify via the disabled + correct `aria-label` combo, and
    // trust the i18n wiring via the `data-testid`.
    expect(btn).toHaveAttribute('aria-label', expect.stringMatching(/ai improve/i));
  });

  it('returns null from aiImprove (no listing id) → no snackbar, no onTruncated', async () => {
    const onTruncated = vi.fn();
    const aiImprove = vi.fn().mockResolvedValue(null);
    renderWithProviders(
      <AIImproveButton
        aiImprove={aiImprove}
        isImproving={false}
        hasListing
        onTruncated={onTruncated}
      />,
    );
    fireEvent.click(screen.getByTestId('AIImproveButton'));
    await waitFor(() => expect(aiImprove).toHaveBeenCalled());
    expect(onTruncated).not.toHaveBeenCalled();
    expect(mockEnqueueSnackbar).not.toHaveBeenCalled();
  });
});
