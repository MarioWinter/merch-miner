import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../utils/test-utils';
import { AdaptationProgress } from '../partials/AdaptationProgress';
import { makeAdaptationRun } from './fixtures';

describe('AdaptationProgress', () => {
  it('renders progress title', () => {
    renderWithProviders(
      <AdaptationProgress run={makeAdaptationRun()} />,
    );
    expect(screen.getByText('Adaptation Progress')).toBeInTheDocument();
  });

  it('renders status chip matching run status', () => {
    renderWithProviders(
      <AdaptationProgress run={makeAdaptationRun({ status: 'running' })} />,
    );
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('renders completed status chip', () => {
    renderWithProviders(
      <AdaptationProgress
        run={makeAdaptationRun({ status: 'completed' })}
      />,
    );
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows linear progress bar when running', () => {
    renderWithProviders(
      <AdaptationProgress run={makeAdaptationRun({ status: 'running' })} />,
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('does not show progress bar when completed', () => {
    renderWithProviders(
      <AdaptationProgress
        run={makeAdaptationRun({ status: 'completed' })}
      />,
    );
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('shows current node when running', () => {
    renderWithProviders(
      <AdaptationProgress
        run={makeAdaptationRun({
          status: 'running',
          current_node: 'adapt_slogans',
        })}
      />,
    );
    expect(
      screen.getByText('Running: adapt_slogans'),
    ).toBeInTheDocument();
  });

  it('renders per-niche results', () => {
    renderWithProviders(
      <AdaptationProgress
        run={makeAdaptationRun({
          status: 'completed',
          niche_results: {
            'niche-2': {
              niche_name: 'Cat Lovers',
              status: 'approved',
              compatibility_score: 85,
            },
            'niche-3': {
              niche_name: 'Bird Watchers',
              status: 'rejected',
              rejection_reason: 'Low compatibility',
            },
          },
        })}
      />,
    );
    expect(screen.getByText('Cat Lovers')).toBeInTheDocument();
    expect(screen.getByText('Bird Watchers')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('Low compatibility')).toBeInTheDocument();
  });

  it('shows niche status chips', () => {
    renderWithProviders(
      <AdaptationProgress
        run={makeAdaptationRun({
          status: 'completed',
          niche_results: {
            'n1': {
              niche_name: 'Test',
              status: 'approved',
            },
          },
        })}
      />,
    );
    expect(screen.getByText('approved')).toBeInTheDocument();
  });

  it('shows error message when present', () => {
    renderWithProviders(
      <AdaptationProgress
        run={makeAdaptationRun({
          status: 'failed',
          error_message: 'Content policy violation',
        })}
      />,
    );
    expect(
      screen.getByText('Content policy violation'),
    ).toBeInTheDocument();
  });

  it('does not show error section when no error', () => {
    renderWithProviders(
      <AdaptationProgress
        run={makeAdaptationRun({ status: 'completed', error_message: '' })}
      />,
    );
    // No error text should be present
    expect(
      screen.queryByText(/policy/i),
    ).not.toBeInTheDocument();
  });
});
