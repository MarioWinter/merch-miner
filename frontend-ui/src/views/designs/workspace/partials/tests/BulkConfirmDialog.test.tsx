import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import BulkConfirmDialog from '../BulkConfirmDialog';

describe('BulkConfirmDialog (PROJ-9 Phase O)', () => {
  it('does not render content when closed', () => {
    renderWithProviders(
      <BulkConfirmDialog
        open={false}
        count={75}
        isSending={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByText(/sending 75/i)).not.toBeInTheDocument();
  });

  it('renders the count in the body when open', () => {
    renderWithProviders(
      <BulkConfirmDialog
        open={true}
        count={75}
        isSending={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/75/)).toBeInTheDocument();
  });

  it('calls onConfirm when Send button is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <BulkConfirmDialog
        open={true}
        count={51}
        isSending={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /^Send$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <BulkConfirmDialog
        open={true}
        count={51}
        isSending={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while sending', () => {
    renderWithProviders(
      <BulkConfirmDialog
        open={true}
        count={75}
        isSending={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /^Send$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
  });
});
