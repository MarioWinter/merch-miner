import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import { makePipelineTool } from './fixtures';

// -----------------------------------------------------------------
// Mocks — must be before component import
// -----------------------------------------------------------------

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: () => ({}),
  useSensors: () => [],
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  horizontalListSortingStrategy: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: vi.fn(),
}));

vi.mock('@dnd-kit/modifiers', () => ({
  restrictToHorizontalAxis: vi.fn(),
  restrictToParentElement: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => null } },
}));

// Mock ToolIcons — simple spans
vi.mock('../partials/ToolIcons', () => ({
  TOOL_ICON_MAP: new Proxy(
    {},
    { get: () => () => <span data-testid="tool-icon" /> },
  ),
}));

// Now import component after mocks
import { PipelineBar } from '../partials/PipelineBar';

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe('PipelineBar', () => {
  const defaultProps = {
    activePipeline: [] as ReturnType<typeof makePipelineTool>[],
    onAddTool: vi.fn(),
    onToggleTool: vi.fn(),
    onRemoveTool: vi.fn(),
    onReorder: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all tool category labels', () => {
    renderWithProviders(<PipelineBar {...defaultProps} />);
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Edge Cleanup')).toBeInTheDocument();
    expect(screen.getByText('AI Processing')).toBeInTheDocument();
  });

  it('renders inactive tool chips for catalog tools', () => {
    renderWithProviders(<PipelineBar {...defaultProps} />);
    expect(screen.getByText('Resize & Reposition')).toBeInTheDocument();
    expect(screen.getByText('Trim')).toBeInTheDocument();
    expect(screen.getByText('BG Remove')).toBeInTheDocument();
    expect(screen.getByText('AI Upscale')).toBeInTheDocument();
  });

  it('calls onAddTool when inactive chip clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PipelineBar {...defaultProps} />);
    await user.click(screen.getByText('Trim'));
    expect(defaultProps.onAddTool).toHaveBeenCalledTimes(1);
    const call = defaultProps.onAddTool.mock.calls[0][0];
    expect(call.name).toBe('trim');
    expect(call.enabled).toBe(true);
  });

  it('renders active chip when tool is in pipeline', () => {
    const activeTool = makePipelineTool({ id: 'tool-1', name: 'trim' });
    renderWithProviders(
      <PipelineBar {...defaultProps} activePipeline={[activeTool]} />,
    );
    expect(screen.getByText('Trim')).toBeInTheDocument();
  });

  it('calls onToggleTool when active chip clicked', async () => {
    const user = userEvent.setup();
    const activeTool = makePipelineTool({ id: 'tool-1', name: 'trim' });
    renderWithProviders(
      <PipelineBar {...defaultProps} activePipeline={[activeTool]} />,
    );
    await user.click(screen.getByText('Trim'));
    expect(defaultProps.onToggleTool).toHaveBeenCalledWith('tool-1');
  });
});
