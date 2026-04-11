import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import { ExportDialog } from '../partials/ExportDialog';
import { makeBatchImage, makeBatchImages } from './fixtures';

// -----------------------------------------------------------------
// Mock useExportDialog hook
// -----------------------------------------------------------------

const mockDownloadCurrent = vi.fn();
const mockDownloadAllZip = vi.fn().mockResolvedValue(undefined);
const mockBuildSettings = vi.fn().mockReturnValue({
  format: 'png',
  dpi: 300,
  compression: 80,
  overwriteOriginal: false,
});
const mockSetFormat = vi.fn();
const mockSetDpi = vi.fn();
const mockSetQuality = vi.fn();
const mockSetOverwriteOriginal = vi.fn();

vi.mock('../hooks/useExportDialog', () => ({
  default: () => ({
    format: 'png',
    setFormat: mockSetFormat,
    dpi: 300,
    setDpi: mockSetDpi,
    quality: 80,
    setQuality: mockSetQuality,
    overwriteOriginal: false,
    setOverwriteOriginal: mockSetOverwriteOriginal,
    buildSettings: mockBuildSettings,
    downloadCurrent: mockDownloadCurrent,
    downloadAllZip: mockDownloadAllZip,
    isCreatingZip: false,
    zipProgress: 0,
    estimatedCurrentSize: 512000,
    resultDimensions: { width: 4500, height: 5400 },
  }),
  formatFileSize: (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },
  estimateCompressedSize: () => 0,
}));

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe('ExportDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    currentImage: makeBatchImage(),
    batchImages: makeBatchImages(3),
    onDownloadCurrent: vi.fn(),
    onDownloadAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open', () => {
    renderWithProviders(<ExportDialog {...defaultProps} />);
    expect(screen.getByText('Advanced Export')).toBeInTheDocument();
  });

  it('does not render dialog content when closed', () => {
    renderWithProviders(<ExportDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Advanced Export')).not.toBeInTheDocument();
  });

  it('renders format toggle buttons', () => {
    renderWithProviders(<ExportDialog {...defaultProps} />);
    expect(screen.getByText('PNG')).toBeInTheDocument();
    expect(screen.getByText('JPEG')).toBeInTheDocument();
    expect(screen.getByText('WebP')).toBeInTheDocument();
  });

  it('renders compression slider', () => {
    renderWithProviders(<ExportDialog {...defaultProps} />);
    expect(screen.getByText('Compression')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('renders resolution slider with DPI value', () => {
    renderWithProviders(<ExportDialog {...defaultProps} />);
    expect(screen.getByText('Resolution')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
  });

  it('shows estimated size for current image', () => {
    renderWithProviders(<ExportDialog {...defaultProps} />);
    expect(screen.getByText('Est. size: 500.0 KB')).toBeInTheDocument();
  });

  it('shows result dimensions', () => {
    renderWithProviders(<ExportDialog {...defaultProps} />);
    expect(screen.getByText('4500 × 5400 px')).toBeInTheDocument();
  });

  it('renders download current button', () => {
    renderWithProviders(<ExportDialog {...defaultProps} />);
    expect(screen.getByText('Download Current')).toBeInTheDocument();
  });

  it('renders download zip button', () => {
    renderWithProviders(<ExportDialog {...defaultProps} />);
    expect(screen.getByText('Download All (ZIP)')).toBeInTheDocument();
  });

  it('calls onDownloadCurrent and downloadCurrent when download button clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportDialog {...defaultProps} />);
    await user.click(screen.getByText('Download Current'));
    expect(defaultProps.onDownloadCurrent).toHaveBeenCalled();
    expect(mockDownloadCurrent).toHaveBeenCalled();
  });

  it('calls onDownloadAll and downloadAllZip when zip button clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportDialog {...defaultProps} />);
    await user.click(screen.getByText('Download All (ZIP)'));
    expect(defaultProps.onDownloadAll).toHaveBeenCalled();
    expect(mockDownloadAllZip).toHaveBeenCalled();
  });

  it('disables download current when no currentImage', () => {
    renderWithProviders(
      <ExportDialog {...defaultProps} currentImage={null} />,
    );
    const btn = screen.getByText('Download Current').closest('button');
    expect(btn).toBeDisabled();
  });

  it('disables download zip when no batch images', () => {
    renderWithProviders(
      <ExportDialog {...defaultProps} batchImages={[]} />,
    );
    const btn = screen.getByText('Download All (ZIP)').closest('button');
    expect(btn).toBeDisabled();
  });

  it('renders close button', () => {
    renderWithProviders(<ExportDialog {...defaultProps} />);
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportDialog {...defaultProps} />);
    await user.click(screen.getByLabelText('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders overwrite toggle options', () => {
    renderWithProviders(<ExportDialog {...defaultProps} />);
    expect(screen.getByText('Create new version')).toBeInTheDocument();
  });

  it('renders image count', () => {
    renderWithProviders(<ExportDialog {...defaultProps} />);
    expect(screen.getByText('3 images')).toBeInTheDocument();
  });
});
