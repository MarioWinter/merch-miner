import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import ChangelogWidget from '../index';

vi.mock('../hooks/useChangelog', () => ({
  useChangelog: vi.fn(),
}));

import { useChangelog } from '../hooks/useChangelog';

const mockedUseChangelog = vi.mocked(useChangelog);

const defaultReturn = {
  versions: [],
  isLoading: false,
  isError: false,
};

describe('ChangelogWidget', () => {
  beforeEach(() => {
    mockedUseChangelog.mockReset();
  });

  it('renders 3 skeleton rows while loading', () => {
    mockedUseChangelog.mockReturnValue({ ...defaultReturn, isLoading: true });

    const { container } = renderWithProviders(<ChangelogWidget />);
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBe(3);
  });

  it('renders version headings and bullet items when data present', () => {
    mockedUseChangelog.mockReturnValue({
      ...defaultReturn,
      versions: [
        {
          version: '0.7.1',
          date: '2026-05-30',
          items: [
            'Verbesserungen am Chat-Fokus-Indikator',
            'Schnellere Web-Suche fuer den Chat-Agenten',
          ],
        },
        {
          version: '0.7.0',
          date: '2026-05-15',
          items: [
            'Niche-Agent gibt jetzt belastbare Web-Quellen aus',
            'Snackbar-Polishing fuer Bug-Report-Erfassung',
          ],
        },
      ],
    });

    renderWithProviders(<ChangelogWidget />);

    // Version headings (regex to remain stable across locales / RTF wording).
    const headingV071 = screen.getByText(/v0\.7\.1\s*\(.+\)/);
    expect(headingV071).toBeInTheDocument();
    expect(screen.getByText(/v0\.7\.0\s*\(.+\)/)).toBeInTheDocument();

    // Bullet items for both versions render verbatim.
    expect(
      screen.getByText('Verbesserungen am Chat-Fokus-Indikator'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Schnellere Web-Suche fuer den Chat-Agenten'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Niche-Agent gibt jetzt belastbare Web-Quellen aus'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Snackbar-Polishing fuer Bug-Report-Erfassung'),
    ).toBeInTheDocument();
  });

  it('shows empty placeholder when there are no versions', () => {
    mockedUseChangelog.mockReturnValue({ ...defaultReturn, versions: [] });

    renderWithProviders(<ChangelogWidget />);

    expect(screen.getByText('Updates coming soon')).toBeInTheDocument();
  });

  it('renders a warning Alert when the request errors', () => {
    mockedUseChangelog.mockReturnValue({ ...defaultReturn, isError: true });

    renderWithProviders(<ChangelogWidget />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('Could not load changelog')).toBeInTheDocument();
  });
});
