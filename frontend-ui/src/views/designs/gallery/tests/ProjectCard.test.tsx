import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { fa } = vi.hoisted(() => ({
  fa: (n: string) => ({ reducerPath: n, reducer: () => ({}), middleware: () => (x: any) => (a: any) => x(a), util: { resetApiState: () => ({ type: 'noop' }) } }),
}));
vi.mock('@/store/nicheSlice', () => ({ nicheApi: fa('nicheApi'), useListNichesQuery: () => ({ data: { results: [] }, isLoading: false }) }));
vi.mock('@/store/ideaSlice', () => ({ ideaApi: fa('ideaApi') }));
vi.mock('@/store/researchSlice', () => ({ researchApi: fa('researchApi') }));
vi.mock('@/store/designSlice', () => ({
  designApi: fa('designApi'),
  useListProjectsQuery: () => ({ data: { results: [] }, isLoading: false }),
  useCreateProjectMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) }), { isLoading: false }],
  useAddIdeasToProjectMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) }), { isLoading: false }],
  useDeleteProjectMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock('@/store/keywordSlice', () => ({ keywordApi: fa('keywordApi') }));
vi.mock('@/store/publishSlice', () => ({ publishApi: fa('publishApi') }));
vi.mock('@/store/dashboardSlice', () => ({ dashboardApi: fa('dashboardApi') }));
vi.mock('@/store/kanbanSlice', () => ({ kanbanApi: fa('kanbanApi') }));
vi.mock('@/store/notificationSlice', () => ({ notificationApi: fa('notificationApi') }));
vi.mock('@/store/searchSlice', () => ({ searchApi: fa('searchApi') }));
vi.mock('@/store/agentSlice', () => ({ agentApi: fa('agentApi') }));
vi.mock('@/store/collectedProductsSlice', () => ({ collectedProductsApi: fa('collectedProductsApi') }));

import { renderWithProviders } from '../../../../utils/test-utils';
import ProjectCard from '../../gallery/partials/ProjectCard';
import { makeProjectListItem } from '../../board/tests/fixtures';

afterEach(() => {
  vi.clearAllMocks();
});

describe('ProjectCard', () => {
  it('renders project name', () => {
    const project = makeProjectListItem({ name: 'Summer Dogs' });
    renderWithProviders(
      <ProjectCard project={project} onClick={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByText('Summer Dogs')).toBeInTheDocument();
  });

  it('renders design count', () => {
    const project = makeProjectListItem({ design_count: 5 });
    renderWithProviders(
      <ProjectCard project={project} onClick={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByText('5 designs')).toBeInTheDocument();
  });

  it('renders singular design count', () => {
    const project = makeProjectListItem({ design_count: 1 });
    renderWithProviders(
      <ProjectCard project={project} onClick={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByText('1 design')).toBeInTheDocument();
  });

  it('renders niche chip when niche_name is present', () => {
    const project = makeProjectListItem({ niche_name: 'Funny Dogs' });
    renderWithProviders(
      <ProjectCard project={project} onClick={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByText('Funny Dogs')).toBeInTheDocument();
  });

  it('does not render niche chip when niche_name is null', () => {
    const project = makeProjectListItem({ niche_name: null });
    renderWithProviders(
      <ProjectCard project={project} onClick={vi.fn()} onDelete={vi.fn()} />,
    );
    // Should not have a chip element for niche
    expect(screen.queryByText('Funny Dogs')).not.toBeInTheDocument();
  });

  it('renders thumbnail image when available', () => {
    const project = makeProjectListItem({
      thumbnail: 'https://example.com/thumb.png',
      name: 'Test Project',
    });
    renderWithProviders(
      <ProjectCard project={project} onClick={vi.fn()} onDelete={vi.fn()} />,
    );
    const img = screen.getByAltText('Test Project');
    expect(img).toHaveAttribute('src', 'https://example.com/thumb.png');
  });

  it('renders placeholder icon when no thumbnail', () => {
    const project = makeProjectListItem({ thumbnail: null });
    renderWithProviders(
      <ProjectCard project={project} onClick={vi.fn()} onDelete={vi.fn()} />,
    );
    // MUI ImageOutlinedIcon is rendered as placeholder
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('calls onClick with project id when clicked', () => {
    const onClick = vi.fn();
    const project = makeProjectListItem({ id: 'proj-42' });
    renderWithProviders(
      <ProjectCard project={project} onClick={onClick} onDelete={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /open project/i }));
    expect(onClick).toHaveBeenCalledWith('proj-42');
  });

  it('calls onClick on Enter key press', () => {
    const onClick = vi.fn();
    const project = makeProjectListItem({ id: 'proj-42' });
    renderWithProviders(
      <ProjectCard project={project} onClick={onClick} onDelete={vi.fn()} />,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: /open project/i }), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledWith('proj-42');
  });

  it('calls onClick on Space key press', () => {
    const onClick = vi.fn();
    const project = makeProjectListItem({ id: 'proj-42' });
    renderWithProviders(
      <ProjectCard project={project} onClick={onClick} onDelete={vi.fn()} />,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: /open project/i }), { key: ' ' });
    expect(onClick).toHaveBeenCalledWith('proj-42');
  });

  it('has correct aria-label', () => {
    const project = makeProjectListItem({ name: 'My Cool Project' });
    renderWithProviders(
      <ProjectCard project={project} onClick={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /open project/i })).toHaveAttribute(
      'aria-label',
      'Open project My Cool Project',
    );
  });
});
