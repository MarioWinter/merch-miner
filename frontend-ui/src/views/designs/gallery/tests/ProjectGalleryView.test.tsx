import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { fa } = vi.hoisted(() => ({
  fa: (n: string) => ({ reducerPath: n, reducer: () => ({}), middleware: () => (x: any) => (a: any) => x(a), util: { resetApiState: () => ({ type: 'noop' }) } }),
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

// Mock designSlice with controllable query hooks
const mockListProjectsQuery = vi.fn();
const mockCreateProjectMutation = vi.fn();

vi.mock('@/store/designSlice', () => ({
  designApi: fa('designApi'),
  useListProjectsQuery: () => mockListProjectsQuery(),
  useCreateProjectMutation: () => mockCreateProjectMutation(),
}));

import { renderWithProviders } from '../../../../utils/test-utils';
import ProjectGalleryView from '../../gallery/ProjectGalleryView';
import { makeProjectListItem } from '../../board/tests/fixtures';

afterEach(() => {
  vi.clearAllMocks();
});

describe('ProjectGalleryView', () => {
  // -- Loading state --
  it('shows skeleton cards during loading', () => {
    mockListProjectsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    mockCreateProjectMutation.mockReturnValue([vi.fn(), { isLoading: false }]);

    const { container } = renderWithProviders(<ProjectGalleryView />);
    // MUI Skeleton renders spans with animation classes
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // -- Error state --
  it('shows error message on load failure', () => {
    mockListProjectsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    mockCreateProjectMutation.mockReturnValue([vi.fn(), { isLoading: false }]);

    renderWithProviders(<ProjectGalleryView />);
    expect(screen.getByText('Failed to load projects')).toBeInTheDocument();
  });

  // -- Empty state --
  it('shows empty state when no projects exist', () => {
    mockListProjectsQuery.mockReturnValue({
      data: { results: [] },
      isLoading: false,
      isError: false,
    });
    mockCreateProjectMutation.mockReturnValue([vi.fn(), { isLoading: false }]);

    renderWithProviders(<ProjectGalleryView />);
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    expect(screen.getByText('New Project')).toBeInTheDocument();
  });

  it('shows empty CTA text', () => {
    mockListProjectsQuery.mockReturnValue({
      data: { results: [] },
      isLoading: false,
      isError: false,
    });
    mockCreateProjectMutation.mockReturnValue([vi.fn(), { isLoading: false }]);

    renderWithProviders(<ProjectGalleryView />);
    expect(
      screen.getByText('Create your first design project to get started'),
    ).toBeInTheDocument();
  });

  // -- Populated state --
  it('renders project cards when projects exist', () => {
    const projects = [
      makeProjectListItem({ id: 'p1', name: 'Project Alpha' }),
      makeProjectListItem({ id: 'p2', name: 'Project Beta' }),
    ];
    mockListProjectsQuery.mockReturnValue({
      data: { results: projects },
      isLoading: false,
      isError: false,
    });
    mockCreateProjectMutation.mockReturnValue([vi.fn(), { isLoading: false }]);

    renderWithProviders(<ProjectGalleryView />);
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
  });

  it('shows page title and create button when populated', () => {
    mockListProjectsQuery.mockReturnValue({
      data: { results: [makeProjectListItem()] },
      isLoading: false,
      isError: false,
    });
    mockCreateProjectMutation.mockReturnValue([vi.fn(), { isLoading: false }]);

    renderWithProviders(<ProjectGalleryView />);
    expect(screen.getByText('Design Forge')).toBeInTheDocument();
    expect(screen.getByText('New Project')).toBeInTheDocument();
  });

  it('renders error state title text', () => {
    mockListProjectsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    mockCreateProjectMutation.mockReturnValue([vi.fn(), { isLoading: false }]);

    renderWithProviders(<ProjectGalleryView />);
    expect(screen.getByText('Design Forge')).toBeInTheDocument();
  });
});
