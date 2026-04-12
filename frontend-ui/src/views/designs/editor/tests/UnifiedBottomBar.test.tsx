import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import { UnifiedBottomBar } from '../partials/UnifiedBottomBar';
import { makeBatchImage } from './fixtures';

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe('UnifiedBottomBar', () => {
  const currentImage = makeBatchImage({
    width: 4500,
    height: 5400,
    fileSize: 2048000,
  });

  const defaultProps = {
    currentImage,
    totalImages: 3,
    onDownloadCurrent: vi.fn(),
    onDownloadAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders in info mode by default', () => {
    renderWithProviders(<UnifiedBottomBar {...defaultProps} />);
    const bar = screen.getByTestId('unified-bottom-bar');
    expect(bar).toHaveAttribute('data-mode', 'info');
  });

  it('shows PNG format badge in info mode', () => {
    renderWithProviders(<UnifiedBottomBar {...defaultProps} />);
    expect(screen.getByText('PNG')).toBeInTheDocument();
  });

  it('shows resolution in info mode', () => {
    renderWithProviders(<UnifiedBottomBar {...defaultProps} />);
    expect(screen.getByText('4500 x 5400')).toBeInTheDocument();
  });

  it('shows file size in info mode', () => {
    renderWithProviders(<UnifiedBottomBar {...defaultProps} />);
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
  });

  it('shows download button in info mode', () => {
    renderWithProviders(<UnifiedBottomBar {...defaultProps} />);
    expect(screen.getByLabelText('Export')).toBeInTheDocument();
  });

  it('switches to export mode when download clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UnifiedBottomBar {...defaultProps} />);

    await user.click(screen.getByLabelText('Export'));

    const bar = screen.getByTestId('unified-bottom-bar');
    expect(bar).toHaveAttribute('data-mode', 'export');
  });

  it('shows DPI slider in export mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UnifiedBottomBar {...defaultProps} />);
    await user.click(screen.getByLabelText('Export'));

    expect(screen.getByLabelText('DPI')).toBeInTheDocument();
  });

  it('shows download buttons in export mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UnifiedBottomBar {...defaultProps} />);
    await user.click(screen.getByLabelText('Export'));

    expect(screen.getByText('Download Current')).toBeInTheDocument();
    expect(screen.getByText('Download All (ZIP)')).toBeInTheDocument();
  });

  it('switches back to info mode when close clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UnifiedBottomBar {...defaultProps} />);

    // Switch to export
    await user.click(screen.getByLabelText('Export'));
    expect(screen.getByTestId('unified-bottom-bar')).toHaveAttribute('data-mode', 'export');

    // Close button
    await user.click(screen.getByLabelText('Close export'));
    expect(screen.getByTestId('unified-bottom-bar')).toHaveAttribute('data-mode', 'info');
  });

  it('hides resolution when image has no dimensions', () => {
    renderWithProviders(
      <UnifiedBottomBar
        {...defaultProps}
        currentImage={makeBatchImage({ width: undefined, height: undefined, fileSize: 1024 })}
      />,
    );
    expect(screen.queryByText(/x/)).not.toBeInTheDocument();
  });

  it('hides file size when zero', () => {
    renderWithProviders(
      <UnifiedBottomBar
        {...defaultProps}
        currentImage={makeBatchImage({ fileSize: 0 })}
      />,
    );
    // Should not render any size text in info mode
    expect(screen.queryByText(/MB/)).not.toBeInTheDocument();
    expect(screen.queryByText(/KB/)).not.toBeInTheDocument();
  });

  it('shows compression dropdown with 5 options in export mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UnifiedBottomBar {...defaultProps} />);
    await user.click(screen.getByLabelText('Export'));

    // Compression dropdown is present
    expect(screen.getByLabelText('Compression')).toBeInTheDocument();
  });

  it('renders with null currentImage without crashing', () => {
    renderWithProviders(
      <UnifiedBottomBar
        {...defaultProps}
        currentImage={null}
      />,
    );
    expect(screen.getByTestId('unified-bottom-bar')).toBeInTheDocument();
  });
});
