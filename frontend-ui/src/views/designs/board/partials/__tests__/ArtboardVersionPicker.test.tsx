import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';

// notistack mock — override useSnackbar but keep SnackbarProvider for test-utils
const enqueueSnackbarMock = vi.fn();
const closeSnackbarMock = vi.fn();
vi.mock('notistack', async (importOriginal) => {
  const actual = await importOriginal<typeof import('notistack')>();
  return {
    ...actual,
    useSnackbar: () => ({
      enqueueSnackbar: enqueueSnackbarMock,
      closeSnackbar: closeSnackbarMock,
    }),
  };
});

// designSlice mock — stub the delete mutation while preserving other exports
// (designApi is required by the test-utils store).
const triggerMock = vi.fn(() => ({ unwrap: () => Promise.resolve({}) }));
vi.mock('@/store/designSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/designSlice')>();
  return {
    ...actual,
    useDeleteDesignVersionMutation: () => [triggerMock, { isLoading: false }],
  };
});

import ArtboardVersionPicker from '../ArtboardVersionPicker';
import type { Design } from '../../types';

const makeDesign = (overrides: Partial<Design> = {}): Design => ({
  id: 'd-1',
  workspace: 'ws-1',
  idea: 'idea-1',
  idea_summary: null,
  generation_run: null,
  image_file: '',
  status: 'approved',
  is_manual: false,
  background_color: 'light_gray',
  source_image_url: '',
  prompt_analysis: {},
  upscaled_file: '',
  bg_removed_file: '',
  processed_file: '',
  created_at: '2026-05-27T10:00:00Z',
  ...overrides,
});

describe('ArtboardVersionPicker', () => {
  beforeEach(() => {
    enqueueSnackbarMock.mockClear();
    closeSnackbarMock.mockClear();
    triggerMock.mockClear();
  });

  it('renders only chips for non-empty slots', () => {
    const design = makeDesign({ image_file: 'x' });
    renderWithProviders(
      <ArtboardVersionPicker
        designId="d-1"
        design={design}
        currentPickedSlot={null}
        onPick={() => {}}
        positionAt={{ x: 0, y: 0 }}
      />,
    );
    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.queryByText('Edited')).toBeNull();
    expect(screen.queryByText('BG Removed')).toBeNull();
    expect(screen.queryByText('Upscaled')).toBeNull();
  });

  it('marks the upscaled chip as active when all 4 slots present and no user pick', () => {
    const design = makeDesign({
      image_file: 'o',
      processed_file: 'p',
      bg_removed_file: 'b',
      upscaled_file: 'u',
    });
    renderWithProviders(
      <ArtboardVersionPicker
        designId="d-1"
        design={design}
        currentPickedSlot={null}
        onPick={() => {}}
        positionAt={{ x: 0, y: 0 }}
      />,
    );
    const upscaledChip = screen.getByText('Upscaled').closest('.MuiChip-root')!;
    expect(upscaledChip).toHaveAttribute('aria-pressed', 'true');
    const originalChip = screen.getByText('Original').closest('.MuiChip-root')!;
    expect(originalChip).toHaveAttribute('aria-pressed', 'false');
  });

  it('respects user pick: when currentPickedSlot=original, original chip is active', () => {
    const design = makeDesign({
      image_file: 'o',
      processed_file: 'p',
      bg_removed_file: 'b',
      upscaled_file: 'u',
    });
    renderWithProviders(
      <ArtboardVersionPicker
        designId="d-1"
        design={design}
        currentPickedSlot="original"
        onPick={() => {}}
        positionAt={{ x: 0, y: 0 }}
      />,
    );
    const originalChip = screen.getByText('Original').closest('.MuiChip-root')!;
    expect(originalChip).toHaveAttribute('aria-pressed', 'true');
    const upscaledChip = screen.getByText('Upscaled').closest('.MuiChip-root')!;
    expect(upscaledChip).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking an inactive chip calls onPick with that slot', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    const design = makeDesign({
      image_file: 'o',
      processed_file: 'p',
      bg_removed_file: 'b',
      upscaled_file: 'u',
    });
    renderWithProviders(
      <ArtboardVersionPicker
        designId="d-1"
        design={design}
        currentPickedSlot={null}
        onPick={onPick}
        positionAt={{ x: 0, y: 0 }}
      />,
    );
    await user.click(screen.getByText('Original'));
    expect(onPick).toHaveBeenCalledWith('original');
  });

  it('clicking the trash icon enqueues a snackbar with an Undo action', async () => {
    // Trash icon is CSS-hover-revealed; bypass pointer-events check.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const design = makeDesign({ image_file: 'o', upscaled_file: 'u' });
    renderWithProviders(
      <ArtboardVersionPicker
        designId="d-1"
        design={design}
        currentPickedSlot={null}
        onPick={() => {}}
        positionAt={{ x: 0, y: 0 }}
      />,
    );
    const trashButtons = screen.getAllByRole('button', { name: /Original/i });
    const trash = trashButtons.find((b) => b.querySelector('svg'))!;
    await user.click(trash);
    expect(enqueueSnackbarMock).toHaveBeenCalledTimes(1);
    const [msg, opts] = enqueueSnackbarMock.mock.calls[0];
    expect(msg).toBe('Version deleted');
    expect(opts.variant).toBe('info');
    expect(typeof opts.action).toBe('function');
  });
});
