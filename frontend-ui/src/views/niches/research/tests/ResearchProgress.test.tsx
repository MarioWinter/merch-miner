import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import { ResearchProgress } from '../partials/ResearchProgress';

describe('ResearchProgress', () => {
  it('renders progress title', () => {
    renderWithProviders(<ResearchProgress status="pending" />);

    expect(screen.getByText('AI Research in progress')).toBeInTheDocument();
  });

  it('renders progress hint text', () => {
    renderWithProviders(<ResearchProgress status="running" />);

    expect(
      screen.getByText('This may take a few minutes. You can leave and come back.'),
    ).toBeInTheDocument();
  });

  it('renders all three stepper steps', () => {
    renderWithProviders(<ResearchProgress status="pending" />);

    expect(screen.getByText('Scraping')).toBeInTheDocument();
    expect(screen.getByText('AI Analysis')).toBeInTheDocument();
    expect(screen.getByText('Saving Results')).toBeInTheDocument();
  });

  it('renders the linear progress bar', () => {
    renderWithProviders(<ResearchProgress status="running" />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
