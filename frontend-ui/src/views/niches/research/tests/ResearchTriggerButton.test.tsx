import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import { ResearchTriggerButton } from '../partials/ResearchTriggerButton';

const defaultProps = {
  status: null as null,
  isPolling: false,
  onTrigger: vi.fn(),
  onCancel: vi.fn(),
};

describe('ResearchTriggerButton', () => {
  it('renders "AI Research" label when idle', () => {
    renderWithProviders(<ResearchTriggerButton {...defaultProps} />);

    expect(screen.getByRole('button', { name: /ai research/i })).toBeInTheDocument();
    expect(screen.getByText('AI Research')).toBeInTheDocument();
  });

  it('renders stop button when status is pending', () => {
    renderWithProviders(
      <ResearchTriggerButton {...defaultProps} status="pending" />,
    );

    expect(screen.getByRole('button', { name: /stop research/i })).toBeInTheDocument();
  });

  it('renders stop button when status is running', () => {
    renderWithProviders(
      <ResearchTriggerButton {...defaultProps} status="running" />,
    );

    expect(screen.getByRole('button', { name: /stop research/i })).toBeInTheDocument();
  });

  it('renders stop button when polling', () => {
    renderWithProviders(
      <ResearchTriggerButton {...defaultProps} isPolling={true} />,
    );

    expect(screen.getByRole('button', { name: /stop research/i })).toBeInTheDocument();
  });

  it('always shows marketplace and product type dropdowns', () => {
    renderWithProviders(
      <ResearchTriggerButton {...defaultProps} status="running" />,
    );

    // Dropdowns are always rendered (siblings of DataPrismButton)
    expect(screen.getByLabelText(/marketplace/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/product type/i)).toBeInTheDocument();
  });

  it('shows marketplace and product type dropdowns when idle', () => {
    renderWithProviders(<ResearchTriggerButton {...defaultProps} />);

    expect(screen.getByLabelText(/marketplace/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/product type/i)).toBeInTheDocument();
  });

  it('calls onCancel when stop button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderWithProviders(
      <ResearchTriggerButton {...defaultProps} status="pending" onCancel={onCancel} />,
    );

    await user.click(screen.getByRole('button', { name: /stop research/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('enables button when status is completed', () => {
    renderWithProviders(
      <ResearchTriggerButton {...defaultProps} status="completed" />,
    );

    expect(screen.getByRole('button', { name: /ai research/i })).toBeEnabled();
  });

  it('shows "Retry Research" when status is failed', () => {
    renderWithProviders(
      <ResearchTriggerButton {...defaultProps} status="failed" />,
    );

    expect(screen.getByText('Retry Research')).toBeInTheDocument();
  });

  it('calls onTrigger when AI button is clicked', async () => {
    const user = userEvent.setup();
    const onTrigger = vi.fn();
    renderWithProviders(
      <ResearchTriggerButton {...defaultProps} onTrigger={onTrigger} />,
    );

    await user.click(screen.getByRole('button', { name: /ai research/i }));
    expect(onTrigger).toHaveBeenCalledOnce();
  });
});
