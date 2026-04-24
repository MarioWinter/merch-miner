import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import UnsavedChangesBanner from '../partials/editor/UnsavedChangesBanner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseProps = {
  isDirty: false,
  isSaving: false,
  saveError: null as Error | null,
  onSave: vi.fn(),
  onDiscard: vi.fn(),
  online: true,
};

const queryBanner = () => screen.queryByTestId('UnsavedChangesBanner');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UnsavedChangesBanner — Phase O3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('renders nothing when idle (not dirty, not saving, no error, online)', () => {
      renderWithProviders(<UnsavedChangesBanner {...baseProps} />);
      expect(queryBanner()).not.toBeInTheDocument();
    });

    it('renders the "unsaved" variant when isDirty', () => {
      renderWithProviders(<UnsavedChangesBanner {...baseProps} isDirty />);
      expect(queryBanner()).toHaveAttribute('data-variant', 'unsaved');
      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    });
  });

  describe('Save / Discard actions', () => {
    it('calls onSave when the Save button is clicked', async () => {
      const onSave = vi.fn();
      renderWithProviders(
        <UnsavedChangesBanner {...baseProps} isDirty onSave={onSave} />,
      );
      await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('opens ConfirmDialog on Discard click and only calls onDiscard after confirm', async () => {
      const onDiscard = vi.fn();
      renderWithProviders(
        <UnsavedChangesBanner {...baseProps} isDirty onDiscard={onDiscard} />,
      );

      // First click opens the dialog but does NOT call onDiscard yet.
      await userEvent.click(screen.getByRole('button', { name: /discard/i }));
      expect(onDiscard).not.toHaveBeenCalled();

      const dialogTitle = await screen.findByText(
        /discard unsaved changes\?/i,
      );
      expect(dialogTitle).toBeInTheDocument();

      // Confirm inside the dialog — there are now two "Discard" buttons
      // (the banner button + the confirm button). Target the one inside
      // role=dialog.
      const dialog = screen.getByRole('dialog');
      const confirmBtn = await waitFor(() =>
        dialog.querySelector('button.MuiButton-outlined'),
      );
      expect(confirmBtn).not.toBeNull();
      await userEvent.click(confirmBtn as HTMLElement);
      expect(onDiscard).toHaveBeenCalledTimes(1);
    });

    it('does not call onDiscard when ConfirmDialog is cancelled', async () => {
      const onDiscard = vi.fn();
      renderWithProviders(
        <UnsavedChangesBanner {...baseProps} isDirty onDiscard={onDiscard} />,
      );
      await userEvent.click(screen.getByRole('button', { name: /discard/i }));
      const dialog = await screen.findByRole('dialog');
      const cancelBtn = dialog.querySelector('button.MuiButton-text');
      await userEvent.click(cancelBtn as HTMLElement);
      expect(onDiscard).not.toHaveBeenCalled();
    });
  });

  describe('state variants', () => {
    it('renders the "saving" variant with spinner when isSaving', () => {
      renderWithProviders(
        <UnsavedChangesBanner {...baseProps} isDirty isSaving />,
      );
      expect(queryBanner()).toHaveAttribute('data-variant', 'saving');
      expect(screen.getByText(/saving\.\.\./i)).toBeInTheDocument();
      // Spinner rendered
      expect(queryBanner()?.querySelector('.MuiCircularProgress-root')).toBeTruthy();
    });

    it('renders the "failed" variant with Retry button on saveError', async () => {
      const onSave = vi.fn();
      renderWithProviders(
        <UnsavedChangesBanner
          {...baseProps}
          isDirty
          saveError={new Error('boom')}
          onSave={onSave}
        />,
      );
      expect(queryBanner()).toHaveAttribute('data-variant', 'failed');
      expect(screen.getByText(/save failed/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /retry/i }));
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('offline state', () => {
    it('renders the "offline" variant when navigator is offline + pending changes', () => {
      renderWithProviders(
        <UnsavedChangesBanner
          {...baseProps}
          isDirty
          online={false}
        />,
      );
      expect(queryBanner()).toHaveAttribute('data-variant', 'offline');
      expect(screen.getByText(/you are offline/i)).toBeInTheDocument();
    });

    it('stays hidden when offline with no pending changes', () => {
      renderWithProviders(<UnsavedChangesBanner {...baseProps} online={false} />);
      expect(queryBanner()).not.toBeInTheDocument();
    });

    it('shows "N queued" chip when offline + queueLength > 0', () => {
      renderWithProviders(
        <UnsavedChangesBanner
          {...baseProps}
          isDirty
          online={false}
          queueLength={3}
        />,
      );
      expect(queryBanner()).toHaveAttribute('data-variant', 'offline');
      const chip = screen.getByTestId('UnsavedChangesBanner-queueChip');
      expect(chip).toHaveTextContent(/3 queued/i);
    });

    it('surfaces offline banner with queue chip even when not dirty (post-reload)', () => {
      // After a reload while offline the client has no dirty state, but
      // the hydrated queue still has pending PATCHes. The banner must
      // still render to warn the user.
      renderWithProviders(
        <UnsavedChangesBanner
          {...baseProps}
          online={false}
          queueLength={2}
        />,
      );
      expect(queryBanner()).toHaveAttribute('data-variant', 'offline');
      expect(
        screen.getByTestId('UnsavedChangesBanner-queueChip'),
      ).toHaveTextContent(/2 queued/i);
    });

    it('omits the queue chip when queueLength is 0', () => {
      renderWithProviders(
        <UnsavedChangesBanner
          {...baseProps}
          isDirty
          online={false}
          queueLength={0}
        />,
      );
      expect(
        screen.queryByTestId('UnsavedChangesBanner-queueChip'),
      ).not.toBeInTheDocument();
    });
  });

  describe('"Saved" toast auto-hide (visual)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows "Saved" for 2s after isSaving transitions to false, then hides', () => {
      const { rerender } = renderWithProviders(
        <UnsavedChangesBanner {...baseProps} isDirty isSaving />,
      );

      // Transition: saving → done (no error, not dirty).
      rerender(
        <UnsavedChangesBanner
          {...baseProps}
          isDirty={false}
          isSaving={false}
        />,
      );
      expect(queryBanner()).toHaveAttribute('data-variant', 'saved');
      expect(screen.getByText(/^saved$/i)).toBeInTheDocument();

      // After 2s the "Saved" toast variant transitions off. The Slide
      // exit animation may leave the wrapping node mounted briefly, but
      // the "Saved" content itself must be gone.
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      // Banner either fully unmounted or no longer advertising the
      // "saved" variant.
      const banner = queryBanner();
      if (banner) {
        expect(banner).not.toHaveAttribute('data-variant', 'saved');
      }
      expect(screen.queryByText(/^saved$/i)).not.toBeInTheDocument();
    });

    it('does not show "Saved" when save ended with an error', () => {
      const { rerender } = renderWithProviders(
        <UnsavedChangesBanner {...baseProps} isDirty isSaving />,
      );
      rerender(
        <UnsavedChangesBanner
          {...baseProps}
          isDirty
          isSaving={false}
          saveError={new Error('boom')}
        />,
      );
      expect(queryBanner()).toHaveAttribute('data-variant', 'failed');
    });
  });
});
