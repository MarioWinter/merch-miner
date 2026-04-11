import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import { BatchThumbnailStrip } from '../partials/BatchThumbnailStrip';
import { makeBatchImage, makeBatchImages } from './fixtures';

// jsdom lacks scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe('BatchThumbnailStrip', () => {
  const defaultProps = {
    images: makeBatchImages(4),
    currentIndex: 0,
    onSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders thumbnails for all batch images', () => {
    renderWithProviders(<BatchThumbnailStrip {...defaultProps} />);
    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(4);
  });

  it('marks the current index as selected', () => {
    renderWithProviders(
      <BatchThumbnailStrip {...defaultProps} currentIndex={1} />,
    );
    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onSelect when thumbnail clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BatchThumbnailStrip {...defaultProps} />);
    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    await user.click(options[2]);
    expect(defaultProps.onSelect).toHaveBeenCalledWith(2);
  });

  it('renders navigation arrows when more than 1 image', () => {
    renderWithProviders(<BatchThumbnailStrip {...defaultProps} />);
    expect(screen.getByLabelText('Previous image')).toBeInTheDocument();
    expect(screen.getByLabelText('Next image')).toBeInTheDocument();
  });

  it('disables previous arrow on first image', () => {
    renderWithProviders(
      <BatchThumbnailStrip {...defaultProps} currentIndex={0} />,
    );
    expect(screen.getByLabelText('Previous image')).toBeDisabled();
  });

  it('disables next arrow on last image', () => {
    renderWithProviders(
      <BatchThumbnailStrip {...defaultProps} currentIndex={3} />,
    );
    expect(screen.getByLabelText('Next image')).toBeDisabled();
  });

  it('does not render nav arrows for single image', () => {
    renderWithProviders(
      <BatchThumbnailStrip
        images={[makeBatchImage()]}
        currentIndex={0}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Previous image')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Next image')).not.toBeInTheDocument();
  });

  it('renders counter text', () => {
    renderWithProviders(
      <BatchThumbnailStrip {...defaultProps} currentIndex={2} />,
    );
    expect(screen.getByText('3 / 4')).toBeInTheDocument();
  });

  it('renders "Add more" button when onAddMore provided', () => {
    const onAddMore = vi.fn();
    renderWithProviders(
      <BatchThumbnailStrip {...defaultProps} onAddMore={onAddMore} />,
    );
    expect(screen.getByLabelText('Add more images')).toBeInTheDocument();
  });

  it('calls onAddMore when add button clicked', async () => {
    const user = userEvent.setup();
    const onAddMore = vi.fn();
    renderWithProviders(
      <BatchThumbnailStrip {...defaultProps} onAddMore={onAddMore} />,
    );
    await user.click(screen.getByLabelText('Add more images'));
    expect(onAddMore).toHaveBeenCalled();
  });

  it('does not render "Add more" when onAddMore not provided', () => {
    renderWithProviders(<BatchThumbnailStrip {...defaultProps} />);
    expect(screen.queryByLabelText('Add more images')).not.toBeInTheDocument();
  });

  it('renders export toggle when showExportToggle and onToggleExport provided', () => {
    renderWithProviders(
      <BatchThumbnailStrip
        {...defaultProps}
        showExportToggle
        onToggleExport={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Export')).toBeInTheDocument();
  });

  it('calls onToggleExport when export button clicked', async () => {
    const user = userEvent.setup();
    const onToggleExport = vi.fn();
    renderWithProviders(
      <BatchThumbnailStrip
        {...defaultProps}
        showExportToggle
        onToggleExport={onToggleExport}
      />,
    );
    await user.click(screen.getByLabelText('Export'));
    expect(onToggleExport).toHaveBeenCalled();
  });

  it('renders cloud import button when onOpenCloudManager provided', () => {
    renderWithProviders(
      <BatchThumbnailStrip
        {...defaultProps}
        onOpenCloudManager={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Import from Cloud')).toBeInTheDocument();
  });

  it('renders empty listbox when no images', () => {
    renderWithProviders(
      <BatchThumbnailStrip
        images={[]}
        currentIndex={0}
        onSelect={vi.fn()}
      />,
    );
    const listbox = screen.getByRole('listbox');
    const options = within(listbox).queryAllByRole('option');
    expect(options).toHaveLength(0);
  });

  it('renders image elements inside thumbnails', () => {
    renderWithProviders(<BatchThumbnailStrip {...defaultProps} />);
    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThanOrEqual(4);
    expect(images[0]).toHaveAttribute('alt', 'design-1.png');
  });
});
