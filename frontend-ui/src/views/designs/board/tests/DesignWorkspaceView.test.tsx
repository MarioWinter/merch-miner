import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';

// JSDOM lacks ResizeObserver — stub it before any component imports
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

/* eslint-disable @typescript-eslint/no-explicit-any */
const { fa } = vi.hoisted(() => ({
  fa: (n: string) => ({ reducerPath: n, reducer: () => ({}), middleware: () => (x: any) => (a: any) => x(a), util: { resetApiState: () => ({ type: 'noop' }), invalidateTags: () => ({ type: 'noop' }) } }),
}));
vi.mock('@/store/nicheSlice', () => ({ nicheApi: fa('nicheApi'), useListNichesQuery: () => ({ data: { results: [] }, isLoading: false }) }));
vi.mock('@/store/ideaSlice', () => ({ ideaApi: fa('ideaApi') }));
vi.mock('@/store/researchSlice', () => ({ researchApi: fa('researchApi') }));
vi.mock('@/store/keywordSlice', () => ({ keywordApi: fa('keywordApi') }));
vi.mock('@/store/publishSlice', () => ({ publishApi: fa('publishApi') }));
vi.mock('@/store/dashboardSlice', () => ({ dashboardApi: fa('dashboardApi') }));
vi.mock('@/store/kanbanSlice', () => ({ kanbanApi: fa('kanbanApi') }));
vi.mock('@/store/notificationSlice', () => ({ notificationApi: fa('notificationApi') }));
vi.mock('@/store/searchSlice', () => ({ searchApi: fa('searchApi') }));
vi.mock('@/store/agentSlice', () => ({ agentApi: fa('agentApi') }));
vi.mock('@/store/collectedProductsSlice', () => ({ collectedProductsApi: fa('collectedProductsApi') }));

// Mock designSlice hooks — all hooks used transitively by DesignWorkspaceView
const mockGetProjectQuery = vi.fn();
const mockGetProjectBoardQuery = vi.fn();

vi.mock('@/store/designSlice', () => ({
  designApi: fa('designApi'),
  useGetProjectQuery: (...args: any[]) => mockGetProjectQuery(...args),
  useGetProjectBoardQuery: (...args: any[]) => mockGetProjectBoardQuery(...args),
  useGenerateDesignForProjectMutation: () => [vi.fn(), { isLoading: false }],
  useGetRunStatusQuery: () => ({ data: undefined }),
  useUpdateProjectMutation: () => [vi.fn(), { isLoading: false }],
  useUploadDesignToProjectMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateDesignStatusMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteDesignMutation: () => [vi.fn(), { isLoading: false }],
  useBatchProcessMutation: () => [vi.fn(), { isLoading: false }],
  useGetProcessingJobQuery: () => ({ data: undefined }),
  useAnalyzeImageMutation: () => [vi.fn(), { isLoading: false }],
  useGetDesignsByIdsQuery: () => ({ data: [] }),
}));

// Mock react-router-dom params
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-1' }),
  };
});

// Mock Konva canvas (not available in JSDOM)
vi.mock('react-konva', () => ({
  Stage: ({ children }: any) => <div data-testid="konva-stage">{children}</div>,
  Layer: ({ children }: any) => <div>{children}</div>,
  Rect: () => <div />,
  Group: ({ children }: any) => <div>{children}</div>,
  Text: () => <div />,
  Image: () => <div />,
  Line: () => <div />,
  Circle: () => <div />,
  Arrow: () => <div />,
}));

vi.mock('konva', () => ({
  default: {
    Animation: class { start() {} stop() {} },
    Image: { fromURL: vi.fn() },
  },
}));

// Mock heavy partials to avoid deep Konva/canvas dependency chains
vi.mock('../../board/partials/ArtboardCanvas', () => ({
  default: () => <div data-testid="artboard-canvas">Canvas</div>,
}));
vi.mock('../../editor/DesignEditorView', () => ({
  default: () => <div data-testid="design-editor">Editor</div>,
}));
vi.mock('../../board/partials/NicheBindingSelector', () => ({
  default: () => <div data-testid="niche-binding">Niche Binding</div>,
}));
vi.mock('../../board/partials/ExportDialog', () => ({
  default: () => null,
}));
vi.mock('../../board/partials/RightPanel', () => ({
  default: () => <div data-testid="right-panel">Right Panel</div>,
}));
vi.mock('../../board/partials/BottomToolbar', () => ({
  default: () => <div data-testid="bottom-toolbar">Toolbar</div>,
}));

import { renderWithProviders } from '../../../../utils/test-utils';
import DesignWorkspaceView from '../../workspace/DesignWorkspaceView';
import { makeProject } from './fixtures';

afterEach(() => {
  vi.clearAllMocks();
});

describe('DesignWorkspaceView', () => {
  // -- Loading state --
  it('shows skeleton header during loading', () => {
    mockGetProjectQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    mockGetProjectBoardQuery.mockReturnValue({ data: undefined });

    const { container } = renderWithProviders(<DesignWorkspaceView />);
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // -- Error state --
  it('shows error alert on load failure', () => {
    mockGetProjectQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    mockGetProjectBoardQuery.mockReturnValue({ data: undefined });

    renderWithProviders(<DesignWorkspaceView />);
    expect(screen.getByText('Failed to load project')).toBeInTheDocument();
    expect(screen.getByText('Back to Gallery')).toBeInTheDocument();
  });

  // -- Populated state --
  it('renders project name in header', () => {
    mockGetProjectQuery.mockReturnValue({
      data: makeProject({ name: 'My Cool Project' }),
      isLoading: false,
      isError: false,
    });
    mockGetProjectBoardQuery.mockReturnValue({
      data: { designs: [], board_layout: null },
    });

    renderWithProviders(<DesignWorkspaceView />);
    expect(screen.getByText('My Cool Project')).toBeInTheDocument();
  });

  it('renders tab buttons for canvas and editor', () => {
    mockGetProjectQuery.mockReturnValue({
      data: makeProject(),
      isLoading: false,
      isError: false,
    });
    mockGetProjectBoardQuery.mockReturnValue({
      data: { designs: [], board_layout: null },
    });

    renderWithProviders(<DesignWorkspaceView />);
    expect(screen.getByText('Artboard Canvas')).toBeInTheDocument();
    expect(screen.getByText('Image Editor')).toBeInTheDocument();
  });

  it('renders back button', () => {
    mockGetProjectQuery.mockReturnValue({
      data: makeProject(),
      isLoading: false,
      isError: false,
    });
    mockGetProjectBoardQuery.mockReturnValue({
      data: { designs: [], board_layout: null },
    });

    renderWithProviders(<DesignWorkspaceView />);
    expect(screen.getByLabelText('Back to Gallery')).toBeInTheDocument();
  });

  it('renders prompt bar in canvas tab', () => {
    mockGetProjectQuery.mockReturnValue({
      data: makeProject(),
      isLoading: false,
      isError: false,
    });
    mockGetProjectBoardQuery.mockReturnValue({
      data: { designs: [], board_layout: null },
    });

    renderWithProviders(<DesignWorkspaceView />);
    expect(screen.getByLabelText(/open prompt bar/i)).toBeInTheDocument();
  });

  it('renders settings icon button', () => {
    mockGetProjectQuery.mockReturnValue({
      data: makeProject(),
      isLoading: false,
      isError: false,
    });
    mockGetProjectBoardQuery.mockReturnValue({
      data: { designs: [], board_layout: null },
    });

    renderWithProviders(<DesignWorkspaceView />);
    expect(screen.getByLabelText('Project Settings')).toBeInTheDocument();
  });
});
