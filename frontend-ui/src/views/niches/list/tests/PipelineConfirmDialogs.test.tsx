import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import { PipelineConfirmDialogs } from '../partials/PipelineConfirmDialogs';

const defaultProps = {
  archiveDialogOpen: false,
  setArchiveDialogOpen: vi.fn(),
  handleArchiveConfirm: vi.fn(),
  deleting: false,
  unsavedDialogOpen: false,
  setUnsavedDialogOpen: vi.fn(),
  discardAndClose: vi.fn(),
  linkedIdeasDialogOpen: false,
  linkedIdeaCount: 0,
  handleArchiveWithIdeas: vi.fn(),
  handleLinkedIdeasCancel: vi.fn(),
};

describe('PipelineConfirmDialogs — linked ideas dialog', () => {
  it('renders linked-ideas dialog when open', () => {
    renderWithProviders(
      <PipelineConfirmDialogs
        {...defaultProps}
        linkedIdeasDialogOpen={true}
        linkedIdeaCount={7}
      />,
    );

    expect(screen.getByText(/has linked ideas/i)).toBeInTheDocument();
    expect(screen.getByText(/7/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /archive all/i })).toBeInTheDocument();
  });

  it('calls handleArchiveWithIdeas on confirm click', async () => {
    const handleArchiveWithIdeas = vi.fn();
    renderWithProviders(
      <PipelineConfirmDialogs
        {...defaultProps}
        linkedIdeasDialogOpen={true}
        linkedIdeaCount={3}
        handleArchiveWithIdeas={handleArchiveWithIdeas}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /archive all/i }));
    expect(handleArchiveWithIdeas).toHaveBeenCalledTimes(1);
  });

  it('calls handleLinkedIdeasCancel on cancel click', async () => {
    const handleLinkedIdeasCancel = vi.fn();
    renderWithProviders(
      <PipelineConfirmDialogs
        {...defaultProps}
        linkedIdeasDialogOpen={true}
        linkedIdeaCount={3}
        handleLinkedIdeasCancel={handleLinkedIdeasCancel}
      />,
    );

    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    // The cancel button in the linked-ideas dialog
    await userEvent.click(cancelButtons[cancelButtons.length - 1]);
    expect(handleLinkedIdeasCancel).toHaveBeenCalledTimes(1);
  });

  it('does not render linked-ideas dialog when closed', () => {
    renderWithProviders(
      <PipelineConfirmDialogs
        {...defaultProps}
        linkedIdeasDialogOpen={false}
        linkedIdeaCount={5}
      />,
    );

    expect(screen.queryByText(/has linked ideas/i)).not.toBeInTheDocument();
  });
});
