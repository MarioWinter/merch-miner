import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import { EditorCanvas } from '../partials/EditorCanvas';
import { makeBatchImage, makeProcessedBatchImage } from './fixtures';

// -----------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------

vi.mock('react-konva', () => ({
  Stage: ({ children, ...props }: Record<string, unknown> & { children: React.ReactNode }) => (
    <div data-testid="konva-stage" data-width={props.width} data-height={props.height}>
      {children}
    </div>
  ),
  Layer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Image: () => <div data-testid="konva-image" />,
}));

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

// jsdom lacks pointer capture + scrollIntoView
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe('EditorCanvas', () => {
  const defaultProps = {
    image: makeBatchImage(),
    activeTool: 'move' as const,
    onToolChange: vi.fn(),
    batchIndex: 0,
    batchTotal: 3,
    onNavigate: vi.fn(),
    onRemoveImage: vi.fn(),
    onRemoveAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Konva stage', () => {
    renderWithProviders(<EditorCanvas {...defaultProps} />);
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
  });

  it('renders batch navigation with correct count', () => {
    renderWithProviders(<EditorCanvas {...defaultProps} />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('disables previous button on first image', () => {
    const { container } = renderWithProviders(<EditorCanvas {...defaultProps} batchIndex={0} />);
    // MUI Tooltip wraps disabled IconButton in a <span> — query the real <button>
    const prevBtn = container.querySelector('button[aria-label="Previous image"]');
    expect(prevBtn).toBeTruthy();
    expect(prevBtn).toBeDisabled();
  });

  it('disables next button on last image', () => {
    const { container } = renderWithProviders(
      <EditorCanvas {...defaultProps} batchIndex={2} batchTotal={3} />,
    );
    const nextBtn = container.querySelector('button[aria-label="Next image"]');
    expect(nextBtn).toBeTruthy();
    expect(nextBtn).toBeDisabled();
  });

  it('calls onNavigate when next button clicked', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(
      <EditorCanvas {...defaultProps} batchIndex={1} batchTotal={3} />,
    );
    const nextBtn = container.querySelector('button[aria-label="Next image"]') as HTMLElement;
    expect(nextBtn).toBeTruthy();
    await user.click(nextBtn);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith(2);
  });

  it('renders canvas toolbar with move and eraser tools', () => {
    renderWithProviders(<EditorCanvas {...defaultProps} />);
    expect(screen.getByLabelText('Move')).toBeInTheDocument();
    expect(screen.getByLabelText('Eraser')).toBeInTheDocument();
  });

  it('calls onToolChange when eraser clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EditorCanvas {...defaultProps} />);
    await user.click(screen.getByLabelText('Eraser'));
    expect(defaultProps.onToolChange).toHaveBeenCalledWith('eraser');
  });

  it('renders zoom controls', () => {
    renderWithProviders(<EditorCanvas {...defaultProps} />);
    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders center/fit button', () => {
    renderWithProviders(<EditorCanvas {...defaultProps} />);
    expect(screen.getByLabelText('Center & fit image')).toBeInTheDocument();
  });

  it('renders delete and remove all buttons', () => {
    renderWithProviders(<EditorCanvas {...defaultProps} />);
    expect(screen.getByLabelText('Remove image')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove all')).toBeInTheDocument();
  });

  it('calls onRemoveAll when delete all button clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EditorCanvas {...defaultProps} />);
    await user.click(screen.getByLabelText('Remove all'));
    expect(defaultProps.onRemoveAll).toHaveBeenCalled();
  });

  it('renders undo/redo buttons', () => {
    renderWithProviders(<EditorCanvas {...defaultProps} />);
    expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    expect(screen.getByLabelText('Redo')).toBeInTheDocument();
  });

  it('disables undo/redo when canUndo/canRedo are false', () => {
    renderWithProviders(
      <EditorCanvas {...defaultProps} canUndo={false} canRedo={false} />,
    );
    expect(screen.getByLabelText('Undo')).toBeDisabled();
    expect(screen.getByLabelText('Redo')).toBeDisabled();
  });

  it('enables undo when canUndo is true', () => {
    renderWithProviders(
      <EditorCanvas {...defaultProps} canUndo={true} />,
    );
    expect(screen.getByLabelText('Undo')).not.toBeDisabled();
  });

  it('shows server processing overlay when isServerProcessing', () => {
    renderWithProviders(
      <EditorCanvas {...defaultProps} isServerProcessing={true} />,
    );
    expect(screen.getByText('Processing on server...')).toBeInTheDocument();
  });

  it('does not show processing overlay by default', () => {
    renderWithProviders(<EditorCanvas {...defaultProps} />);
    expect(screen.queryByText('Processing on server...')).not.toBeInTheDocument();
  });

  it('renders BG preview swatches', () => {
    renderWithProviders(<EditorCanvas {...defaultProps} />);
    expect(screen.getByLabelText('Transparent (checkerboard)')).toBeInTheDocument();
    expect(screen.getByLabelText('Black background')).toBeInTheDocument();
    expect(screen.getByLabelText('White background')).toBeInTheDocument();
    expect(screen.getByLabelText('Gray background')).toBeInTheDocument();
    expect(screen.getByLabelText('Custom color')).toBeInTheDocument();
  });

  it('shows "Show original" button when image has processed version', () => {
    renderWithProviders(
      <EditorCanvas {...defaultProps} image={makeProcessedBatchImage()} />,
    );
    expect(screen.getByLabelText('Show original')).toBeInTheDocument();
  });

  it('does not show "Show original" for unprocessed images', () => {
    renderWithProviders(<EditorCanvas {...defaultProps} />);
    expect(screen.queryByLabelText('Show original')).not.toBeInTheDocument();
  });
});
