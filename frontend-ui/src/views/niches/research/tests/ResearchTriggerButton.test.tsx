import { describe, it, expect, vi } from 'vitest';
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

  // PROJ-28 — product_limit input
  describe('product limit input', () => {
    it('renders the product limit input with default 50', () => {
      renderWithProviders(<ResearchTriggerButton {...defaultProps} />);

      const input = screen.getByLabelText(/products/i) as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(50);
    });

    it('clamps values below 10 up to 10 on blur', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ResearchTriggerButton {...defaultProps} />);

      const input = screen.getByLabelText(/products/i) as HTMLInputElement;
      await user.clear(input);
      await user.type(input, '5');
      await user.tab(); // triggers blur

      expect(input).toHaveValue(10);
    });

    it('clamps values above 200 down to 200 on blur', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ResearchTriggerButton {...defaultProps} />);

      const input = screen.getByLabelText(/products/i) as HTMLInputElement;
      await user.clear(input);
      await user.type(input, '500');
      await user.tab();

      expect(input).toHaveValue(200);
    });

    it('falls back to 50 when input is cleared', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ResearchTriggerButton {...defaultProps} />);

      const input = screen.getByLabelText(/products/i) as HTMLInputElement;
      await user.clear(input);
      await user.tab();

      expect(input).toHaveValue(50);
    });

    it('passes product_limit reflecting current state to onTrigger', async () => {
      const user = userEvent.setup();
      const onTrigger = vi.fn();
      renderWithProviders(
        <ResearchTriggerButton {...defaultProps} onTrigger={onTrigger} />,
      );

      const input = screen.getByLabelText(/products/i) as HTMLInputElement;
      await user.clear(input);
      await user.type(input, '120');
      await user.tab();

      await user.click(screen.getByRole('button', { name: /ai research/i }));

      expect(onTrigger).toHaveBeenCalledWith(
        expect.objectContaining({ product_limit: 120 }),
      );
    });

    it('includes product_limit and force_refresh together when toggled on after completion', async () => {
      const user = userEvent.setup();
      const onTrigger = vi.fn();
      renderWithProviders(
        <ResearchTriggerButton
          {...defaultProps}
          status="completed"
          onTrigger={onTrigger}
        />,
      );

      const input = screen.getByLabelText(/products/i) as HTMLInputElement;
      await user.clear(input);
      await user.type(input, '75');
      await user.tab();

      const forceRefreshSwitch = screen.getByRole('switch', {
        name: /force refresh/i,
      });
      await user.click(forceRefreshSwitch);

      await user.click(screen.getByRole('button', { name: /ai research/i }));

      expect(onTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          product_limit: 75,
          force_refresh: true,
        }),
      );
    });
  });
});
