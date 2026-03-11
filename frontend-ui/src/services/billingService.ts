import { apiClient } from './authService';

export type AccountType = 'personal' | 'business';

export interface BillingProfile {
  account_type: AccountType;
  company_name: string;
  vat_number: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state_region: string;
  postal_code: string;
  country: string;
}

export const billingService = {
  async getBilling(): Promise<BillingProfile> {
    const { data } = await apiClient.get('/api/users/me/billing/');
    return data;
  },

  async putBilling(payload: Partial<BillingProfile>): Promise<BillingProfile> {
    const { data } = await apiClient.put('/api/users/me/billing/', payload);
    return data;
  },
};
