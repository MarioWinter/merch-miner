import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../utils/test-utils';
import ThumbnailHoverPreview from '../index';

// We drive the tooltip with raw mouseOver events + waitFor real timers. This
// avoids fake-timer/userEvent deadlocks in JSDOM while keeping the test fast
// because waitFor polls on a short interval. enterDelay=250ms is comfortably
// inside waitFor's default 1s timeout.

describe('ThumbnailHoverPreview', () => {
  it('renders the preview <img> with matching src when the child is hovered', async () => {
    const previewSrc = 'https://example.com/full.jpg';

    renderWithProviders(
      <ThumbnailHoverPreview src={previewSrc} alt="full preview">
        <img
          src="https://example.com/thumb.jpg"
          alt="thumb"
          data-testid="trigger"
          width={40}
          height={50}
        />
      </ThumbnailHoverPreview>,
    );

    const trigger = screen.getByTestId('trigger');
    fireEvent.mouseOver(trigger);

    const preview = await screen.findByAltText('full preview', {}, { timeout: 2000 });
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute('src', previewSrc);
  });

  it('does NOT wrap with a Tooltip when src is empty (no preview surface)', async () => {
    renderWithProviders(
      <ThumbnailHoverPreview src="">
        <img
          src="/placeholder.png"
          alt="placeholder"
          data-testid="trigger"
          width={40}
          height={50}
        />
      </ThumbnailHoverPreview>,
    );

    // Falsy-src branch renders children directly without the Tooltip wrapper.
    // We assert the trigger image has no <span> parent (Tooltip always injects
    // one to host its mouse handlers).
    const trigger = screen.getByTestId('trigger');
    expect(trigger.parentElement?.tagName).not.toBe('SPAN');

    fireEvent.mouseOver(trigger);

    // Wait past the 250ms enterDelay just to be sure no tooltip appears.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders the preview through a portal (overlay, not inline in flow)', async () => {
    const { container } = renderWithProviders(
      <ThumbnailHoverPreview src="https://example.com/full.jpg" alt="full">
        <img
          src="https://example.com/thumb.jpg"
          alt="thumb"
          data-testid="trigger"
          width={40}
          height={50}
        />
      </ThumbnailHoverPreview>,
    );

    fireEvent.mouseOver(screen.getByTestId('trigger'));

    const preview = await screen.findByAltText('full', {}, { timeout: 2000 });
    await waitFor(() => {
      // Tooltip mounts its Popper into document.body via React Portal so the
      // overlay floats above the table instead of being clipped by the cell.
      expect(container.contains(preview)).toBe(false);
    });
  });
});
