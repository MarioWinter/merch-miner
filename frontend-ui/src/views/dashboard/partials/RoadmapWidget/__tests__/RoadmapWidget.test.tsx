import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import RoadmapWidget from '../index';

vi.mock('../hooks/useRoadmap', () => ({
  useRoadmap: vi.fn(),
}));

import { useRoadmap } from '../hooks/useRoadmap';

const mockedUseRoadmap = vi.mocked(useRoadmap);

const defaultReturn = {
  items: [],
  lastUpdated: null,
  isLoading: false,
  isError: false,
};

describe('RoadmapWidget', () => {
  beforeEach(() => {
    mockedUseRoadmap.mockReset();
  });

  it('renders 3 skeleton rows while loading', () => {
    mockedUseRoadmap.mockReturnValue({ ...defaultReturn, isLoading: true });

    const { container } = renderWithProviders(<RoadmapWidget />);
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBe(3);
  });

  it('renders item titles and descriptions when data present', () => {
    mockedUseRoadmap.mockReturnValue({
      ...defaultReturn,
      items: [
        { title: 'Bulk Upload for Listings', description: 'Upload up to 50 listings at once', priority: 'high' },
        { title: 'Team Kanban Board', description: 'Coordinate tasks without leaving the app' },
      ],
      lastUpdated: '2026-05-31T11:23:45.123456+00:00',
    });

    renderWithProviders(<RoadmapWidget />);

    expect(screen.getByText('Bulk Upload for Listings')).toBeInTheDocument();
    expect(screen.getByText('Upload up to 50 listings at once')).toBeInTheDocument();
    expect(screen.getByText('Team Kanban Board')).toBeInTheDocument();
    expect(screen.getByText('Coordinate tasks without leaving the app')).toBeInTheDocument();
  });

  it('truncates descriptions over 200 chars and keeps full text in title attribute', () => {
    const longDescription = 'a'.repeat(250);
    mockedUseRoadmap.mockReturnValue({
      ...defaultReturn,
      items: [{ title: 'Long Item', description: longDescription }],
    });

    renderWithProviders(<RoadmapWidget />);

    const expectedTruncated = `${'a'.repeat(200)}…`;
    const truncatedEl = screen.getByText(expectedTruncated);
    expect(truncatedEl).toBeInTheDocument();
    expect(truncatedEl).toHaveAttribute('title', longDescription);
  });

  it('shows empty placeholder when there are no items', () => {
    mockedUseRoadmap.mockReturnValue({ ...defaultReturn, items: [] });

    renderWithProviders(<RoadmapWidget />);

    expect(
      screen.getByText('Coming soon: our next roadmap entry'),
    ).toBeInTheDocument();
  });

  it('renders an Alert when the request errors', () => {
    mockedUseRoadmap.mockReturnValue({ ...defaultReturn, isError: true });

    renderWithProviders(<RoadmapWidget />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Could not load roadmap')).toBeInTheDocument();
  });
});
