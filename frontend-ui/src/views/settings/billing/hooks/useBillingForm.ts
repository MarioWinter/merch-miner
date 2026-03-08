import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  billingSchema,
  type BillingFormValues,
} from '../schemas/billingSchema';
import { billingService } from '../../../../services/billingService';

export function useBillingForm() {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<BillingFormValues>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      account_type: 'personal',
      company_name: '',
      vat_number: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state_region: '',
      postal_code: '',
      country: '',
    },
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await billingService.getBilling();
        form.reset({
          account_type: data.account_type ?? 'personal',
          company_name: data.company_name ?? '',
          vat_number: data.vat_number ?? '',
          address_line1: data.address_line1 ?? '',
          address_line2: data.address_line2 ?? '',
          city: data.city ?? '',
          state_region: data.state_region ?? '',
          postal_code: data.postal_code ?? '',
          country: data.country ?? '',
        });
      } catch {
        setError('Failed to load billing info');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(values: BillingFormValues) {
    setSaving(true);
    try {
      await billingService.putBilling(values);
      enqueueSnackbar(t('settings.billing.saveSuccess'), {
        variant: 'success',
      });
    } catch {
      enqueueSnackbar(t('settings.billing.saveError'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return { form, loading, error, saving, handleSave };
}
