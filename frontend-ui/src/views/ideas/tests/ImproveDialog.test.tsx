import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../utils/test-utils';
import { ImproveDialog } from '../partials/ImproveDialog';
import { makeIdea } from './fixtures';

afterEach(() => {
  vi.clearAllMocks();
});

describe('ImproveDialog', () => {
  const idea = makeIdea({ slogan_text: 'Improve this slogan' });

  it('does not render when closed', () => {
    renderWithProviders(
      <ImproveDialog
        open={false}
        onClose={vi.fn()}
        idea={idea}
        onImprove={vi.fn()}
        onSelectVariant={vi.fn()}
        isImproving={false}
      />,
    );
    expect(screen.queryByText('Improve Slogan')).not.toBeInTheDocument();
  });

  it('renders dialog title when open', () => {
    renderWithProviders(
      <ImproveDialog
        open={true}
        onClose={vi.fn()}
        idea={idea}
        onImprove={vi.fn()}
        onSelectVariant={vi.fn()}
        isImproving={false}
      />,
    );
    expect(screen.getByText('Improve Slogan')).toBeInTheDocument();
  });

  it('shows source idea text', () => {
    renderWithProviders(
      <ImproveDialog
        open={true}
        onClose={vi.fn()}
        idea={idea}
        onImprove={vi.fn()}
        onSelectVariant={vi.fn()}
        isImproving={false}
      />,
    );
    expect(screen.getByText(/Improve this slogan/)).toBeInTheDocument();
  });

  it('renders feedback text field initially', () => {
    renderWithProviders(
      <ImproveDialog
        open={true}
        onClose={vi.fn()}
        idea={idea}
        onImprove={vi.fn()}
        onSelectVariant={vi.fn()}
        isImproving={false}
      />,
    );
    expect(
      screen.getByPlaceholderText('Optional feedback for the AI...'),
    ).toBeInTheDocument();
  });

  it('renders improve button initially', () => {
    renderWithProviders(
      <ImproveDialog
        open={true}
        onClose={vi.fn()}
        idea={idea}
        onImprove={vi.fn()}
        onSelectVariant={vi.fn()}
        isImproving={false}
      />,
    );
    expect(screen.getByText('Improve')).toBeInTheDocument();
  });

  it('calls onImprove with feedback when improve button clicked', () => {
    const onImprove = vi.fn().mockResolvedValue([]);
    renderWithProviders(
      <ImproveDialog
        open={true}
        onClose={vi.fn()}
        idea={idea}
        onImprove={onImprove}
        onSelectVariant={vi.fn()}
        isImproving={false}
      />,
    );

    const textarea = screen.getByPlaceholderText('Optional feedback for the AI...');
    fireEvent.change(textarea, { target: { value: 'Make it funnier' } });
    fireEvent.click(screen.getByText('Improve'));

    expect(onImprove).toHaveBeenCalledWith('Make it funnier');
  });

  it('shows variants after improve returns results', async () => {
    const variants = [
      makeIdea({ id: 'v1', slogan_text: 'Variant 1', why_it_works: 'Funny' }),
      makeIdea({ id: 'v2', slogan_text: 'Variant 2' }),
      makeIdea({ id: 'v3', slogan_text: 'Variant 3' }),
    ];
    const onImprove = vi.fn().mockResolvedValue(variants);

    renderWithProviders(
      <ImproveDialog
        open={true}
        onClose={vi.fn()}
        idea={idea}
        onImprove={onImprove}
        onSelectVariant={vi.fn()}
        isImproving={false}
      />,
    );

    fireEvent.click(screen.getByText('Improve'));

    await waitFor(() => {
      expect(screen.getByText('Variant 1')).toBeInTheDocument();
    });
    expect(screen.getByText('Variant 2')).toBeInTheDocument();
    expect(screen.getByText('Variant 3')).toBeInTheDocument();
    expect(screen.getByText('3 variants generated')).toBeInTheDocument();
  });

  it('disables select button until variant selected', async () => {
    const variants = [
      makeIdea({ id: 'v1', slogan_text: 'Variant 1' }),
    ];
    const onImprove = vi.fn().mockResolvedValue(variants);

    renderWithProviders(
      <ImproveDialog
        open={true}
        onClose={vi.fn()}
        idea={idea}
        onImprove={onImprove}
        onSelectVariant={vi.fn()}
        isImproving={false}
      />,
    );

    fireEvent.click(screen.getByText('Improve'));

    await waitFor(() => {
      expect(screen.getByText('Select')).toBeInTheDocument();
    });

    const selectBtn = screen.getByText('Select').closest('button');
    expect(selectBtn).toBeDisabled();
  });

  it('enables select button after clicking a variant', async () => {
    const variants = [
      makeIdea({ id: 'v1', slogan_text: 'Variant 1' }),
    ];
    const onImprove = vi.fn().mockResolvedValue(variants);

    renderWithProviders(
      <ImproveDialog
        open={true}
        onClose={vi.fn()}
        idea={idea}
        onImprove={onImprove}
        onSelectVariant={vi.fn()}
        isImproving={false}
      />,
    );

    fireEvent.click(screen.getByText('Improve'));

    await waitFor(() => {
      expect(screen.getByText('Variant 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Variant 1'));

    const selectBtn = screen.getByText('Select').closest('button');
    expect(selectBtn).not.toBeDisabled();
  });

  it('disables feedback field when isImproving', () => {
    renderWithProviders(
      <ImproveDialog
        open={true}
        onClose={vi.fn()}
        idea={idea}
        onImprove={vi.fn()}
        onSelectVariant={vi.fn()}
        isImproving={true}
      />,
    );
    const textarea = screen.getByPlaceholderText('Optional feedback for the AI...');
    expect(textarea).toBeDisabled();
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <ImproveDialog
        open={true}
        onClose={onClose}
        idea={idea}
        onImprove={vi.fn()}
        onSelectVariant={vi.fn()}
        isImproving={false}
      />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('has correct aria-labelledby on dialog', () => {
    renderWithProviders(
      <ImproveDialog
        open={true}
        onClose={vi.fn()}
        idea={idea}
        onImprove={vi.fn()}
        onSelectVariant={vi.fn()}
        isImproving={false}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'improve-dialog-title');
  });
});
