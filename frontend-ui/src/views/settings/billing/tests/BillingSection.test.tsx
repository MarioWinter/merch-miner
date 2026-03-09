import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { billingService } from '../../../../services/billingService';
import BillingSection from '../BillingSection';
import { renderWithProviders } from '../../../../utils/test-utils';

vi.mock('../../../../services/billingService', () => ({
  billingService: {
    getBilling: vi.fn(),
    putBilling: vi.fn(),
  },
}));

const mockGetBilling = vi.mocked(billingService.getBilling);
const mockPutBilling = vi.mocked(billingService.putBilling);

const emptyBilling = {
  account_type: 'personal' as const,
  company_name: '',
  vat_number: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state_region: '',
  postal_code: '',
  country: '',
};

describe('BillingSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows skeleton while loading', () => {
    mockGetBilling.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<BillingSection />);
    expect(screen.queryByRole('button', { name: /save billing/i })).toBeNull();
  });

  it('renders billing form after load', async () => {
    mockGetBilling.mockResolvedValueOnce(emptyBilling);
    renderWithProviders(<BillingSection />);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /save billing/i })
      ).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /personal/i })).toBeInTheDocument();
  });

  it('shows company name and VAT fields when Business is selected', async () => {
    mockGetBilling.mockResolvedValueOnce(emptyBilling);
    renderWithProviders(<BillingSection />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /business/i })).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole('button', { name: /business/i }));

    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/vat/i)).toBeInTheDocument();
  });

  it('calls putBilling on save and shows success snackbar', async () => {
    mockGetBilling.mockResolvedValueOnce(emptyBilling);
    mockPutBilling.mockResolvedValueOnce(emptyBilling);
    renderWithProviders(<BillingSection />);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /save billing/i })
      ).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole('button', { name: /save billing/i }));

    await waitFor(() => expect(mockPutBilling).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/billing info saved/i)).toBeInTheDocument()
    );
  });

  it('shows error alert when billing fails to load', async () => {
    mockGetBilling.mockRejectedValueOnce(new Error('500'));
    renderWithProviders(<BillingSection />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    );
  });
});
