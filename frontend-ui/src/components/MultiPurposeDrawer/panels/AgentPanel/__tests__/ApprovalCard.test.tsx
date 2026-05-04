/**
 * PROJ-18 Phase 10 — ApprovalCard tests (AC-53)
 *
 * Verifies Approve / Reject buttons trigger the correct callbacks with the
 * action_log_id derived from the approval_request message.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import ApprovalCard from '../../ApprovalCard';
import { buildApprovalRequest } from './fixtures';

describe('ApprovalCard', () => {
  it('renders the action description from message content', () => {
    const message = buildApprovalRequest({ content: 'Approve generating 10 designs?' });
    renderWithProviders(
      <ApprovalCard
        message={message}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        approving={false}
        rejecting={false}
      />,
    );
    expect(screen.getByText(/Approve generating 10 designs/)).toBeInTheDocument();
  });

  it('renders the cost estimate when present', () => {
    const message = buildApprovalRequest();
    renderWithProviders(
      <ApprovalCard
        message={message}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        approving={false}
        rejecting={false}
      />,
    );
    expect(screen.getByText(/0\.05/)).toBeInTheDocument();
  });

  it('clicking Approve invokes onApprove with the action_log_id', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const message = buildApprovalRequest();
    renderWithProviders(
      <ApprovalCard
        message={message}
        onApprove={onApprove}
        onReject={vi.fn()}
        approving={false}
        rejecting={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    expect(onApprove).toHaveBeenCalledWith('log-1');
  });

  it('clicking Reject invokes onReject with the action_log_id', async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    const message = buildApprovalRequest();
    renderWithProviders(
      <ApprovalCard
        message={message}
        onApprove={vi.fn()}
        onReject={onReject}
        approving={false}
        rejecting={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /^reject$/i }));
    expect(onReject).toHaveBeenCalledWith('log-1');
  });

  it('disables Approve when approving=true', () => {
    const message = buildApprovalRequest();
    renderWithProviders(
      <ApprovalCard
        message={message}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        approving={true}
        rejecting={false}
      />,
    );
    expect(screen.getByRole('button', { name: /^approve$/i })).toBeDisabled();
  });

  it('renders nothing when action_log_id is missing from tool_calls', () => {
    const message = buildApprovalRequest({
      tool_calls: [{ tool_name: 'foo', args: {}, result: null, status: 'pending' }],
    });
    const { container } = renderWithProviders(
      <ApprovalCard
        message={message}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        approving={false}
        rejecting={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
