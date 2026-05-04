import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../utils/test-utils';
import { InlineFlowButton, BulkFlowButton } from '../index';

// ── InlineFlowButton ─────────────────────────────────────────────────
describe('InlineFlowButton', () => {
  it('renders button for keywords target', () => {
    renderWithProviders(
      <InlineFlowButton
        target="keywords"
        tooltip="Extract Keywords"
        onClick={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Extract Keywords' });
    expect(btn).toBeInTheDocument();
  });

  it('renders button for slogans target', () => {
    renderWithProviders(
      <InlineFlowButton
        target="slogans"
        tooltip="Generate Slogans"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Generate Slogans' })).toBeInTheDocument();
  });

  it('renders button for canvas target', () => {
    renderWithProviders(
      <InlineFlowButton
        target="canvas"
        tooltip="Send to Canvas"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Send to Canvas' })).toBeInTheDocument();
  });

  it('renders button for listings target', () => {
    renderWithProviders(
      <InlineFlowButton
        target="listings"
        tooltip="Create Listing"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Create Listing' })).toBeInTheDocument();
  });

  it('renders button for upload target', () => {
    renderWithProviders(
      <InlineFlowButton
        target="upload"
        tooltip="Upload"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
  });

  it('renders button for detail target', () => {
    renderWithProviders(
      <InlineFlowButton
        target="detail"
        tooltip="View Detail"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'View Detail' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProviders(
      <InlineFlowButton
        target="keywords"
        tooltip="Extract Keywords"
        onClick={onClick}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Extract Keywords' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders disabled button when disabled prop is true', () => {
    renderWithProviders(
      <InlineFlowButton
        target="keywords"
        tooltip="Extract Keywords"
        onClick={vi.fn()}
        disabled
      />,
    );
    const btn = screen.getByRole('button', { name: 'Extract Keywords' });
    expect(btn).toBeDisabled();
  });

  it('renders correct icon for each target', () => {
    const { unmount } = renderWithProviders(
      <InlineFlowButton target="keywords" tooltip="KW" onClick={vi.fn()} />,
    );
    expect(screen.getByTestId('KeyOutlinedIcon')).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <InlineFlowButton target="slogans" tooltip="SL" onClick={vi.fn()} />,
    );
    expect(screen.getByTestId('LightbulbOutlinedIcon')).toBeInTheDocument();
  });
});

// ── BulkFlowButton ───────────────────────────────────────────────────
describe('BulkFlowButton', () => {
  it('renders label with count', () => {
    renderWithProviders(
      <BulkFlowButton
        target="canvas"
        label="Send to Canvas"
        count={3}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Send to Canvas (3)')).toBeInTheDocument();
  });

  it('renders label without count when count not provided', () => {
    renderWithProviders(
      <BulkFlowButton
        target="canvas"
        label="Send to Canvas"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Send to Canvas')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithProviders(
      <BulkFlowButton
        target="slogans"
        label="Generate Slogans"
        count={5}
        onClick={onClick}
      />,
    );
    await user.click(screen.getByText('Generate Slogans (5)'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders disabled button when disabled prop is true', () => {
    renderWithProviders(
      <BulkFlowButton
        target="canvas"
        label="Send"
        onClick={vi.fn()}
        disabled
      />,
    );
    const btn = screen.getByRole('button', { name: /send/i });
    expect(btn).toBeDisabled();
  });

  it('renders with correct aria-label including count', () => {
    renderWithProviders(
      <BulkFlowButton
        target="listings"
        label="Create Listings"
        count={2}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Create Listings (2)')).toBeInTheDocument();
  });

  it('renders correct icon for target', () => {
    renderWithProviders(
      <BulkFlowButton
        target="canvas"
        label="Canvas"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId('BrushOutlinedIcon')).toBeInTheDocument();
  });
});
