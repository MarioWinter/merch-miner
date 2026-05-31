/**
 * FeedbackReportModal tests — FIX-dashboard-bug-report-and-polish Item 1.
 *
 * Covers AC-1-3 / AC-1-4 / AC-1-12 happy path + validation + screenshot
 * rejection branches + backdrop-close confirm-discard flow.
 *
 * RTK Query mutations are mocked via `vi.mock('@/store/feedbackSlice', …)`
 * so we can assert what the modal would have POSTed without spinning up the
 * real axios baseQuery (mirrors the pattern in useSendMessageStream.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';

// ---- RTK Query mutation mocks ----
const uploadScreenshotMock = vi.fn();
const createReportMock = vi.fn();

// We mock the whole module: both the hooks the modal calls AND the
// `feedbackApi` object that `store/index.ts` registers as a slice. The store
// is reached transitively by axios baseQuery → authService → store, so even
// though renderWithProviders builds its own store, the import graph still
// pulls `feedbackApi` from this module and crashes if it's undefined.
vi.mock('@/store/feedbackSlice', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useUploadScreenshotMutation: () => [
      uploadScreenshotMock,
      { isLoading: false },
    ],
    useCreateReportMutation: () => [createReportMock, { isLoading: false }],
  };
});

// ---- notistack mock — capture enqueueSnackbar calls ----
const enqueueSnackbarMock = vi.fn();
vi.mock('notistack', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useSnackbar: () => ({ enqueueSnackbar: enqueueSnackbarMock }),
  };
});

// Import AFTER mocks so the modal picks them up.
import FeedbackReportModal from '../index';

// Helper — RTK Query mutations expose `.unwrap()` on the returned promise.
const mockMutationResolved = <T,>(value: T) =>
  vi.fn(() => ({
    unwrap: () => Promise.resolve(value),
  }));

const mockMutationRejected = (err: Error) =>
  vi.fn(() => ({
    unwrap: () => Promise.reject(err),
  }));

const onCloseMock = vi.fn();

beforeEach(() => {
  uploadScreenshotMock.mockReset();
  createReportMock.mockReset();
  enqueueSnackbarMock.mockReset();
  onCloseMock.mockReset();
});

const renderModal = () =>
  renderWithProviders(
    <FeedbackReportModal open onClose={onCloseMock} />,
  );

const fillRequiredFields = async (
  user: ReturnType<typeof userEvent.setup>,
  overrides?: { title?: string; description?: string },
) => {
  await user.type(
    screen.getByLabelText(/^Title/i),
    overrides?.title ?? 'Generated thumbnail is blurry',
  );
  await user.type(
    screen.getByLabelText(/^Description/i),
    overrides?.description ??
      'Steps: open canvas, export PNG, thumbnail looks pixelated.',
  );
};

describe('FeedbackReportModal', () => {
  it('happy path: submits the form, calls createReport, shows success snackbar and closes', async () => {
    const user = userEvent.setup();
    createReportMock.mockImplementation(mockMutationResolved({ id: 'r-1' }));

    renderModal();
    await fillRequiredFields(user);

    const submit = screen.getByRole('button', { name: /^Send$/i });
    await waitFor(() => expect(submit).not.toBeDisabled());
    await user.click(submit);

    await waitFor(() => {
      expect(createReportMock).toHaveBeenCalledTimes(1);
    });
    expect(createReportMock).toHaveBeenCalledWith({
      type: 'bug',
      title: 'Generated thumbnail is blurry',
      description: 'Steps: open canvas, export PNG, thumbnail looks pixelated.',
    });
    expect(uploadScreenshotMock).not.toHaveBeenCalled();
    expect(enqueueSnackbarMock).toHaveBeenCalledWith(
      'Thanks! Your feedback has been sent.',
      { variant: 'success' },
    );
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('keeps submit disabled while title is empty', async () => {
    const user = userEvent.setup();
    renderModal();

    const submit = screen.getByRole('button', { name: /^Send$/i });
    expect(submit).toBeDisabled();

    // Only description filled — title still empty.
    await user.type(
      screen.getByLabelText(/^Description/i),
      'Something happened',
    );
    expect(submit).toBeDisabled();
  });

  it('shows the descriptionTooLong helper text when over 4000 chars', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/^Title/i), 'ok');

    // The TextField's `maxLength` attribute would normally prevent the user
    // from typing past 4000, so we bypass it via fireEvent.change to drive a
    // value > 4000 chars directly and force the zod validation branch.
    const descriptionField = screen.getByLabelText(
      /^Description/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(descriptionField, {
      target: { value: 'x'.repeat(4001) },
    });

    await waitFor(() => {
      expect(
        screen.getByText('Description must be 4000 characters or fewer.'),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^Send$/i })).toBeDisabled();
  });

  it('rejects an oversize screenshot (>5 MB) and disables submit', async () => {
    const user = userEvent.setup();
    renderModal();
    await fillRequiredFields(user);

    // 6 MB blob masquerading as PNG.
    const oversize = new File(
      [new Uint8Array(6 * 1024 * 1024)],
      'huge.png',
      { type: 'image/png' },
    );
    const fileInput = screen.getByTestId(
      'feedback-screenshot-input',
    ) as HTMLInputElement;
    await user.upload(fileInput, oversize);

    await waitFor(() => {
      expect(
        screen.getByText('File too large — max 5 MB.'),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^Send$/i })).toBeDisabled();
  });

  it('rejects a non-image upload (application/pdf)', async () => {
    const user = userEvent.setup();
    renderModal();
    await fillRequiredFields(user);

    const pdf = new File(['%PDF-1.4'], 'doc.pdf', {
      type: 'application/pdf',
    });
    const fileInput = screen.getByTestId(
      'feedback-screenshot-input',
    ) as HTMLInputElement;
    // userEvent.upload honors the `accept` attribute and won't even fire
    // change for a mime mismatch. Drive the change event directly to test the
    // component's own mime-validation branch (which is what guards real users
    // who paste a file via DnD or via OS file-picker without the accept filter).
    fireEvent.change(fileInput, { target: { files: [pdf] } });

    await waitFor(() => {
      expect(
        screen.getByText('Only PNG, JPEG or WEBP images are allowed.'),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^Send$/i })).toBeDisabled();
  });

  it('shows the discard-confirm dialog when closing with unsaved input', async () => {
    const user = userEvent.setup();
    renderModal();

    // Make the form dirty.
    await user.type(screen.getByLabelText(/^Title/i), 'wip');

    // Close via the title-row close button (same handler the backdrop uses).
    const closeBtn = screen.getByRole('button', {
      name: 'Close feedback modal',
    });
    await user.click(closeBtn);

    // The discard dialog should be open. Its title comes from the i18n key
    // we registered: feedback.discard.title.
    await waitFor(() => {
      expect(screen.getByText('Discard feedback?')).toBeInTheDocument();
    });

    // onClose must NOT have fired yet — user still has to confirm.
    expect(onCloseMock).not.toHaveBeenCalled();
  });

  it('shows error snackbar when createReport rejects', async () => {
    const user = userEvent.setup();
    createReportMock.mockImplementation(
      mockMutationRejected(new Error('boom')),
    );

    renderModal();
    await fillRequiredFields(user);

    const submit = screen.getByRole('button', { name: /^Send$/i });
    await waitFor(() => expect(submit).not.toBeDisabled());
    await user.click(submit);

    await waitFor(() => {
      expect(enqueueSnackbarMock).toHaveBeenCalledWith(
        'Could not send feedback — please try again later.',
        { variant: 'error' },
      );
    });
    // Modal stays open on error per AC-1-4.
    expect(onCloseMock).not.toHaveBeenCalled();
  });
});
