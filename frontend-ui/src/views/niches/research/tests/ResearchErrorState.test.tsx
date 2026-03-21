import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import { ResearchErrorState } from '../partials/ResearchErrorState';

describe('ResearchErrorState', () => {
  it('renders error message and retry button', () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <ResearchErrorState errorMessage="Node vision_analyze failed" onRetry={onRetry} />,
    );

    expect(screen.getByText('Research Failed')).toBeInTheDocument();
    expect(screen.getByText('Node vision_analyze failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders timeout state', () => {
    const onRetry = vi.fn();
    renderWithProviders(<ResearchErrorState isTimeout onRetry={onRetry} />);

    expect(screen.getByText('Research Timed Out')).toBeInTheDocument();
    expect(screen.getByText(/20-minute limit/)).toBeInTheDocument();
  });

  it('calls onRetry when button clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(<ResearchErrorState errorMessage="Error" onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
