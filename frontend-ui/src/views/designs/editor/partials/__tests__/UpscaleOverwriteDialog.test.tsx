import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import UpscaleOverwriteDialog from '../UpscaleOverwriteDialog';

describe('UpscaleOverwriteDialog', () => {
  it('renders title, body, and both action buttons when open', () => {
    renderWithProviders(
      <UpscaleOverwriteDialog open onCancel={() => {}} onConfirm={() => {}} />,
    );
    expect(
      screen.getByText('Overwrite existing upscaled version?'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/already has an upscaled version/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Overwrite' }),
    ).toBeInTheDocument();
  });

  it('renders nothing when open=false', () => {
    renderWithProviders(
      <UpscaleOverwriteDialog open={false} onCancel={() => {}} onConfirm={() => {}} />,
    );
    expect(
      screen.queryByText('Overwrite existing upscaled version?'),
    ).not.toBeInTheDocument();
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <UpscaleOverwriteDialog open onCancel={onCancel} onConfirm={() => {}} />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Overwrite button is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <UpscaleOverwriteDialog open onCancel={() => {}} onConfirm={onConfirm} />,
    );
    await user.click(screen.getByRole('button', { name: 'Overwrite' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape key is pressed (MUI default close)', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <UpscaleOverwriteDialog open onCancel={onCancel} onConfirm={() => {}} />,
    );
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
