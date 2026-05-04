import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import { PreparingDownloadModal } from '../partials/PreparingDownloadModal';

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe('PreparingDownloadModal', () => {
  const defaultProps = {
    open: true,
    onCancel: vi.fn(),
    compressionLevel: 'medium' as const,
    progress: 45,
    currentImage: 1,
    totalImages: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders spinner and progress bar when open', () => {
    renderWithProviders(<PreparingDownloadModal {...defaultProps} />);
    const progressBars = screen.getAllByRole('progressbar');
    // CircularProgress (spinner) + LinearProgress (bar)
    expect(progressBars.length).toBe(2);
  });

  it('renders "Preparing Download" title', () => {
    renderWithProviders(<PreparingDownloadModal {...defaultProps} />);
    expect(screen.getByText('Preparing Download')).toBeInTheDocument();
  });

  it('renders progress bar', () => {
    renderWithProviders(<PreparingDownloadModal {...defaultProps} />);
    expect(screen.getByRole('progressbar', { name: 'Download progress' })).toBeInTheDocument();
  });

  it('renders cancel button', () => {
    renderWithProviders(<PreparingDownloadModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows single image text when totalImages=1', () => {
    renderWithProviders(<PreparingDownloadModal {...defaultProps} totalImages={1} />);
    expect(screen.getByText('Processing your image...')).toBeInTheDocument();
  });

  it('shows batch text with current/total when totalImages>1', () => {
    renderWithProviders(
      <PreparingDownloadModal {...defaultProps} totalImages={5} currentImage={3} />,
    );
    expect(screen.getByText('Processing 3 of 5...')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel button clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PreparingDownloadModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not render when open=false', () => {
    renderWithProviders(<PreparingDownloadModal {...defaultProps} open={false} />);
    expect(screen.queryByText('Preparing Download')).not.toBeInTheDocument();
  });

  it('shows compression level chip', () => {
    renderWithProviders(<PreparingDownloadModal {...defaultProps} compressionLevel="high" />);
    expect(screen.getByText(/High/)).toBeInTheDocument();
  });
});
